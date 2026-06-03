import { Controller, Get, Post, Put, Delete, Body, Req, Res, Query, UseGuards, HttpCode, Headers } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutoconfirmService } from './autoconfirm.service';

@Controller('autoconfirm')
export class AutoconfirmController {
  constructor(private svc: AutoconfirmService) {}

  // ─── OAuth: get install URL ────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('shopify/oauth-url')
  getOAuthUrl(@Req() req: any, @Body() body: { shopDomain: string }) {
    return { url: this.svc.buildOAuthUrl(body.shopDomain, req.user.id) };
  }

  // ─── OAuth: callback from Shopify ─────────────────────────────────────────

  @Get('shopify/callback')
  async shopifyCallback(
    @Query('code') code: string,
    @Query('shop') shop: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      await this.svc.handleOAuthCallback(shop, code, state);
      return res.redirect('https://kababard.online/autoconfirm?connected=1');
    } catch (err: any) {
      return res.redirect(`https://kababard.online/autoconfirm?error=${encodeURIComponent(err.message)}`);
    }
  }

  // ─── Connect Shopify via client credentials (modern flow) ─────────────────

  @UseGuards(JwtAuthGuard)
  @Post('shopify/connect')
  connectStore(@Req() req: any, @Body() body: { shopDomain: string; accessToken?: string; clientId?: string; clientSecret?: string }) {
    if (body.clientId && body.clientSecret) {
      return this.svc.connectStoreWithCredentials(req.user.id, body.shopDomain, body.clientId, body.clientSecret);
    }
    return this.svc.connectStore(req.user.id, body.shopDomain, body.accessToken!);
  }

  // ─── Shopify webhook ───────────────────────────────────────────────────────

  @Post('shopify/webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-shopify-shop-domain') shopDomain: string,
    @Headers('x-shopify-hmac-sha256') hmac: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rawBody = (req as any).rawBody as Buffer | string | undefined;
    const rawStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : (rawBody ?? '');
    if (hmac && rawStr) {
      const store = shopDomain ? await this.svc.getStoreByDomain(shopDomain) : null;
      const valid = this.svc.verifyWebhookHmac(rawStr, hmac, store?.clientSecret ?? undefined);
      if (!valid) return res.status(401).json({ message: 'Invalid HMAC' });
    }
    const order = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : (rawStr ? JSON.parse(rawStr) : null);
    if (shopDomain && order) {
      this.svc.processOrder(shopDomain, order).catch(err =>
        console.error('[AutoConfirm webhook]', err.message)
      );
    }
    return res.json({ ok: true });
  }

  // ─── Store ─────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('store')
  getStore(@Req() req: any) {
    return this.svc.getStore(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('store')
  disconnectStore(@Req() req: any) {
    return this.svc.disconnectStore(req.user.id);
  }

  // ─── Template ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Put('template')
  updateTemplate(@Req() req: any, @Body() body: { messageTemplate?: string }) {
    return this.svc.updateTemplate(req.user.id, body);
  }

  // ─── WhatsApp ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('whatsapp/init')
  @HttpCode(200)
  async initWhatsapp(@Req() req: any) {
    await this.svc.initWhatsapp(req.user.id);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('whatsapp/status')
  getWhatsappStatus(@Req() req: any) {
    return this.svc.getWhatsappStatus(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('whatsapp')
  disconnectWhatsapp(@Req() req: any) {
    return this.svc.disconnectWhatsapp(req.user.id);
  }

  // ─── Labels ────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('whatsapp/labels')
  getWhatsappLabels(@Req() req: any) {
    return this.svc.getWhatsappLabels(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('labels/config')
  getLabelConfig(@Req() req: any) {
    return this.svc.getStoreLabelConfig(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('labels/config')
  updateLabels(@Req() req: any, @Body() body: { labelPendingId?: string; labelConfirmedId?: string; labelCancelledId?: string }) {
    return this.svc.updateLabels(req.user.id, body);
  }

  // ─── Logs ──────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('logs')
  getLogs(@Req() req: any) {
    return this.svc.getLogs(req.user.id, 50);
  }

  // ─── Message usage ─────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('msg-usage')
  getMsgUsage(@Req() req: any) {
    return this.svc.getMsgUsage(req.user.id);
  }
}
