import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ShopifyStore } from './entities/shopify-store.entity';
import { OrderLog } from './entities/order-log.entity';

@Injectable()
export class AutoconfirmService {
  private readonly logger = new Logger(AutoconfirmService.name);

  constructor(
    private config: ConfigService,
    @InjectRepository(ShopifyStore)
    private storeRepo: Repository<ShopifyStore>,
    @InjectRepository(OrderLog)
    private logRepo: Repository<OrderLog>,
  ) {}

  // ─── Shopify OAuth ────────────────────────────────────────────────────────

  getInstallUrl(userId: string, shop: string): string {
    const clientId = this.config.get<string>('SHOPIFY_CLIENT_ID');
    const redirectUri = this.config.get<string>('SHOPIFY_REDIRECT_URI');
    const scopes = 'read_orders';
    const state = Buffer.from(`${userId}:${Date.now()}`).toString('base64url');
    return `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}&grant_options[]=value`;
  }

  async handleCallback(code: string, shop: string, state: string): Promise<string> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const clientId = this.config.get<string>('SHOPIFY_CLIENT_ID');
    const clientSecret = this.config.get<string>('SHOPIFY_CLIENT_SECRET');

    let userId: string;
    try {
      const decoded = Buffer.from(state, 'base64url').toString();
      userId = decoded.split(':')[0];
    } catch {
      throw new BadRequestException('Invalid state');
    }

    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    if (!tokenRes.ok) {
      this.logger.error(`Shopify token exchange failed: ${await tokenRes.text()}`);
      return `${frontendUrl}/autoconfirm?error=token_failed`;
    }

    const { access_token } = await tokenRes.json() as { access_token: string };

    let store = await this.storeRepo.findOne({ where: { shopDomain: shop } });
    if (store) {
      store.accessToken = access_token;
      store.userId = userId;
      store.isActive = true;
    } else {
      store = this.storeRepo.create({ userId, shopDomain: shop, accessToken: access_token });
    }
    await this.storeRepo.save(store);

    await this.registerWebhook(store);

    return `${frontendUrl}/autoconfirm?connected=true`;
  }

  private async registerWebhook(store: ShopifyStore): Promise<void> {
    const webhookUrl = this.config.get<string>('SHOPIFY_WEBHOOK_URL');

    if (store.webhookId) {
      await fetch(`https://${store.shopDomain}/admin/api/2024-01/webhooks/${store.webhookId}.json`, {
        method: 'DELETE',
        headers: { 'X-Shopify-Access-Token': store.accessToken },
      }).catch(() => null);
    }

    const res = await fetch(`https://${store.shopDomain}/admin/api/2024-01/webhooks.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook: {
          topic: 'orders/create',
          address: webhookUrl,
          format: 'json',
        },
      }),
    });

    if (res.ok) {
      const data = await res.json() as { webhook: { id: number } };
      store.webhookId = String(data.webhook.id);
      await this.storeRepo.save(store);
      this.logger.log(`Webhook registrado para ${store.shopDomain}: ${store.webhookId}`);
    } else {
      this.logger.warn(`Error registrando webhook: ${await res.text()}`);
    }
  }

  // ─── Webhook handler ─────────────────────────────────────────────────────

  verifyWebhookHmac(rawBody: string, hmacHeader: string): boolean {
    const secret = this.config.get<string>('SHOPIFY_CLIENT_SECRET', '');
    const computed = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
  }

  async processOrder(shopDomain: string, orderData: any): Promise<void> {
    const store = await this.storeRepo.findOne({ where: { shopDomain, isActive: true } });
    if (!store) return;

    const orderId = String(orderData.id);
    const existing = await this.logRepo.findOne({ where: { storeId: store.id, shopifyOrderId: orderId } });
    if (existing) return;

    const phone = orderData.billing_address?.phone || orderData.shipping_address?.phone || orderData.customer?.phone;
    const customerName = orderData.customer?.first_name || orderData.billing_address?.first_name || 'Cliente';
    const orderNumber = String(orderData.order_number || orderData.name || orderId);
    const storeName = orderData.shop_name || store.shopDomain.replace('.myshopify.com', '');

    const log = this.logRepo.create({
      storeId: store.id,
      shopifyOrderId: orderId,
      orderNumber,
      customerName,
      customerPhone: phone || null,
    });

    if (!phone) {
      log.status = 'failed';
      log.error = 'No phone number in order';
      await this.logRepo.save(log);
      return;
    }

    const message = this.renderTemplate(store.messageTemplate, { nombre: customerName, numero: orderNumber, tienda: storeName });
    log.messageSent = message;

    try {
      if (store.whatsappEnabled && store.whatsappTemplateName) {
        await this.sendWhatsApp(this.normalizePhone(phone), store.whatsappTemplateName, store.whatsappLanguage, [customerName, orderNumber, storeName]);
        log.status = 'sent';
      } else {
        log.status = 'pending';
        log.error = 'WhatsApp no configurado — mensaje en cola';
      }
    } catch (err: any) {
      log.status = 'failed';
      log.error = err.message;
    }

    await this.logRepo.save(log);
    this.logger.log(`[AutoConfirm] Orden #${orderNumber} (${store.shopDomain}) → ${log.status}`);
  }

  private renderTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (phone.startsWith('+')) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    return `+${digits}`;
  }

  private async sendWhatsApp(to: string, templateName: string, language: string, params: string[]): Promise<void> {
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');

    if (!token || !phoneNumberId) throw new Error('WhatsApp no configurado en .env');

    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language || 'es' },
        components: [
          {
            type: 'body',
            parameters: params.map(text => ({ type: 'text', text })),
          },
        ],
      },
    };

    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Meta API error: ${err}`);
    }
  }

  // ─── Store management ─────────────────────────────────────────────────────

  async getStore(userId: string): Promise<ShopifyStore | null> {
    return this.storeRepo.findOne({ where: { userId, isActive: true } });
  }

  async disconnectStore(userId: string): Promise<void> {
    const store = await this.storeRepo.findOne({ where: { userId } });
    if (!store) throw new NotFoundException('No store connected');

    if (store.webhookId) {
      await fetch(`https://${store.shopDomain}/admin/api/2024-01/webhooks/${store.webhookId}.json`, {
        method: 'DELETE',
        headers: { 'X-Shopify-Access-Token': store.accessToken },
      }).catch(() => null);
    }

    store.isActive = false;
    await this.storeRepo.save(store);
  }

  async updateTemplate(userId: string, dto: { messageTemplate?: string; whatsappTemplateName?: string; whatsappLanguage?: string; whatsappEnabled?: boolean }): Promise<ShopifyStore> {
    const store = await this.storeRepo.findOne({ where: { userId, isActive: true } });
    if (!store) throw new NotFoundException('No store connected');
    Object.assign(store, dto);
    return this.storeRepo.save(store);
  }

  async getLogs(userId: string, limit = 50): Promise<OrderLog[]> {
    const store = await this.storeRepo.findOne({ where: { userId, isActive: true } });
    if (!store) return [];
    return this.logRepo.find({
      where: { storeId: store.id },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
