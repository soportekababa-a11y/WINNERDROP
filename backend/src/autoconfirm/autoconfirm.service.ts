import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

const SHOPIFY_SCOPES = 'read_orders,write_orders';
import { ShopifyStore } from './entities/shopify-store.entity';
import { OrderLog } from './entities/order-log.entity';
import { User } from '../users/user.entity';
import { WhatsappService } from './whatsapp.service';

@Injectable()
export class AutoconfirmService {
  private readonly logger = new Logger(AutoconfirmService.name);

  constructor(
    private config: ConfigService,
    @InjectRepository(ShopifyStore)
    private storeRepo: Repository<ShopifyStore>,
    @InjectRepository(OrderLog)
    private logRepo: Repository<OrderLog>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private whatsapp: WhatsappService,
  ) {}

  async getMsgUsage(userId: string): Promise<{ used: number; limit: number }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const limit = user?.msgMonthlyLimit ?? 50;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const used = await this.logRepo
      .createQueryBuilder('log')
      .innerJoin(ShopifyStore, 'store', 'store.id = log.storeId')
      .where('store.userId = :userId', { userId })
      .andWhere('log.status = :status', { status: 'sent' })
      .andWhere('log.createdAt >= :monthStart', { monthStart })
      .getCount();
    return { used, limit };
  }

  private async checkMsgLimit(userId: string): Promise<void> {
    const { used, limit } = await this.getMsgUsage(userId);
    if (limit !== -1 && used >= limit) throw new ForbiddenException('MSG_LIMIT_REACHED');
  }

  private oauthStates = new Map<string, string>(); // nonce → userId

  buildOAuthUrl(shopDomain: string, userId: string): string {
    let domain = shopDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!domain.includes('.myshopify.com')) domain = `${domain}.myshopify.com`;
    const clientId = this.config.get<string>('SHOPIFY_CLIENT_ID', '');
    const redirectUri = this.config.get<string>('SHOPIFY_REDIRECT_URI', 'http://116.203.82.110/autoconfirm/callback');
    const nonce = crypto.randomBytes(16).toString('hex');
    this.oauthStates.set(nonce, userId);
    setTimeout(() => this.oauthStates.delete(nonce), 10 * 60 * 1000); // expire in 10min
    return `https://${domain}/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(SHOPIFY_SCOPES)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;
  }

  async handleOAuthCallback(shopDomain: string, code: string, state: string): Promise<void> {
    const userId = this.oauthStates.get(state);
    if (!userId) throw new Error('Estado OAuth inválido o expirado');
    this.oauthStates.delete(state);

    const clientId = this.config.get<string>('SHOPIFY_CLIENT_ID', '');
    const clientSecret = this.config.get<string>('SHOPIFY_CLIENT_SECRET', '');

    const tokenRes = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    if (!tokenRes.ok) throw new Error(`Shopify token exchange failed: ${tokenRes.status}`);
    const { access_token } = await tokenRes.json() as { access_token: string };

    await this.connectStore(userId, shopDomain, access_token);
  }

  // ─── Connect store via access token ──────────────────────────────────────

  async connectStore(userId: string, shopDomain: string, accessToken: string): Promise<ShopifyStore> {
    let domain = shopDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!domain.includes('.myshopify.com')) domain = `${domain}.myshopify.com`;

    // Verify token works
    const verifyRes = await fetch(`https://${domain}/admin/api/2025-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });
    if (!verifyRes.ok) {
      const status = verifyRes.status;
      if (status === 401 || status === 403) throw new BadRequestException('Token inválido — verifica que copiaste el Admin API access token (shpat_...) y que la app está instalada');
      if (status === 404) throw new BadRequestException('Dominio incorrecto — verifica el nombre de la tienda');
      throw new BadRequestException(`Error Shopify ${status} — verifica dominio y token`);
    }

    let store = await this.storeRepo.findOne({ where: { userId } });
    if (!store) store = await this.storeRepo.findOne({ where: { shopDomain: domain } });
    if (store) {
      store.userId = userId;
      store.shopDomain = domain;
      store.accessToken = accessToken;
      store.isActive = true;
      store.webhookId = null!;
    } else {
      store = this.storeRepo.create({ userId, shopDomain: domain, accessToken });
    }
    await this.storeRepo.save(store);
    await this.registerWebhook(store);
    return store;
  }

  private async registerWebhook(store: ShopifyStore): Promise<void> {
    const webhookUrl = this.config.get<string>('SHOPIFY_WEBHOOK_URL', `http://116.203.82.110/api/proxy/autoconfirm/shopify/webhook`);

    if (store.webhookId) {
      await fetch(`https://${store.shopDomain}/admin/api/2025-01/webhooks/${store.webhookId}.json`, {
        method: 'DELETE',
        headers: { 'X-Shopify-Access-Token': store.accessToken },
      }).catch(() => null);
    }

    const res = await fetch(`https://${store.shopDomain}/admin/api/2025-01/webhooks.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhook: { topic: 'orders/create', address: webhookUrl, format: 'json' } }),
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
    if (!secret) return true; // skip verification if secret not set
    const computed = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    try {
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
    } catch {
      return false;
    }
  }

  async processOrder(shopDomain: string, orderData: any): Promise<void> {
    const store = await this.storeRepo.findOne({ where: { shopDomain, isActive: true } });
    if (!store) return;

    const orderId = String(orderData.id);
    const existing = await this.logRepo.findOne({ where: { storeId: store.id, shopifyOrderId: orderId } });
    if (existing) return;

    const phone = orderData.phone || orderData.customer?.phone || orderData.billing_address?.phone || orderData.shipping_address?.phone;
    const customerName = orderData.customer?.first_name || orderData.billing_address?.first_name || 'Cliente';
    const orderNumber = String(orderData.order_number || orderData.name || orderId);
    const storeName = store.shopDomain.replace('.myshopify.com', '');
    const city = orderData.shipping_address?.city || orderData.billing_address?.city || '';
    const price = orderData.total_price ? `${orderData.total_price} ${orderData.currency || ''}`.trim() : '';
    const products = (orderData.line_items as any[] || []).map((i: any) => i.name || i.title).join(', ') || '';

    const log = this.logRepo.create({ storeId: store.id, shopifyOrderId: orderId, orderNumber, customerName, customerPhone: phone || null });

    if (!phone) {
      log.status = 'failed';
      log.error = 'Sin teléfono en el pedido';
      await this.logRepo.save(log);
      return;
    }

    const vars = { nombre: customerName, numero: orderNumber, tienda: storeName, ciudad: city, precio: price, productos: products };
    const message = this.renderTemplate(store.messageTemplate, vars);
    log.messageSent = message;

    try {
      await this.checkMsgLimit(store.userId);
      const waStatus = this.whatsapp.getStatus(store.id);
      if (waStatus.status === 'connected') {
        await this.logRepo.save(log); // save first to get log.id
        await this.whatsapp.sendOrderConfirmation(
          store.id,
          this.normalizePhone(phone),
          message,
          log.id,
          orderId,
          store.shopDomain,
          store.accessToken,
          this.renderTemplate(store.confirmMessage, vars),
          this.renderTemplate(store.cancelMessage, vars),
          store.labelPendingId ?? undefined,
          store.labelConfirmedId ?? undefined,
          store.labelCancelledId ?? undefined,
        );
        log.status = 'sent';
      } else {
        log.status = 'pending';
        log.error = `WhatsApp ${waStatus.status === 'disconnected' ? 'no conectado' : 'conectando...'}`;
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

  // ─── Store management ─────────────────────────────────────────────────────

  async getStore(userId: string): Promise<ShopifyStore | null> {
    return this.storeRepo.findOne({ where: { userId, isActive: true } });
  }

  async disconnectStore(userId: string): Promise<void> {
    const store = await this.storeRepo.findOne({ where: { userId } });
    if (!store) throw new NotFoundException('No hay tienda conectada');
    if (store.webhookId) {
      await fetch(`https://${store.shopDomain}/admin/api/2025-01/webhooks/${store.webhookId}.json`, {
        method: 'DELETE',
        headers: { 'X-Shopify-Access-Token': store.accessToken },
      }).catch(() => null);
    }
    store.isActive = false;
    await this.storeRepo.save(store);
  }

  async updateTemplate(userId: string, dto: { messageTemplate?: string; confirmMessage?: string; cancelMessage?: string }): Promise<ShopifyStore> {
    const store = await this.storeRepo.findOne({ where: { userId, isActive: true } });
    if (!store) throw new NotFoundException('No hay tienda conectada');
    Object.assign(store, dto);
    return this.storeRepo.save(store);
  }

  async initWhatsapp(userId: string): Promise<void> {
    const store = await this.storeRepo.findOne({ where: { userId, isActive: true } });
    if (!store) throw new NotFoundException('No hay tienda conectada');
    await this.whatsapp.initSession(store.id);
  }

  async getWhatsappStatus(userId: string): Promise<{ status: string; qr?: string }> {
    const store = await this.storeRepo.findOne({ where: { userId, isActive: true } });
    if (!store) return { status: 'disconnected' };
    return this.whatsapp.getStatus(store.id);
  }

  async disconnectWhatsapp(userId: string): Promise<void> {
    const store = await this.storeRepo.findOne({ where: { userId, isActive: true } });
    if (!store) throw new NotFoundException('No hay tienda conectada');
    await this.whatsapp.disconnect(store.id);
  }

  async getLogs(userId: string, limit = 50): Promise<OrderLog[]> {
    const store = await this.storeRepo.findOne({ where: { userId, isActive: true } });
    if (!store) return [];
    return this.logRepo.find({ where: { storeId: store.id }, order: { createdAt: 'DESC' }, take: limit });
  }

  async getWhatsappLabels(userId: string): Promise<Array<{ id: string; name: string; color: number }>> {
    const store = await this.storeRepo.findOne({ where: { userId, isActive: true } });
    if (!store) return [];
    return this.whatsapp.getSessionLabels(store.id);
  }

  async updateLabels(userId: string, dto: { labelPendingId?: string; labelConfirmedId?: string; labelCancelledId?: string }): Promise<ShopifyStore> {
    const store = await this.storeRepo.findOne({ where: { userId, isActive: true } });
    if (!store) throw new NotFoundException('No hay tienda conectada');
    Object.assign(store, dto);
    return this.storeRepo.save(store);
  }

  async getStoreLabelConfig(userId: string): Promise<{ labelPendingId: string | null; labelConfirmedId: string | null; labelCancelledId: string | null }> {
    const store = await this.storeRepo.findOne({ where: { userId, isActive: true } });
    if (!store) return { labelPendingId: null, labelConfirmedId: null, labelCancelledId: null };
    return { labelPendingId: store.labelPendingId ?? null, labelConfirmedId: store.labelConfirmedId ?? null, labelCancelledId: store.labelCancelledId ?? null };
  }
}
