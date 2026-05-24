import { Controller, Get, Post, Put, Delete, Body, Req, Res, UseGuards, HttpCode, Headers } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutoconfirmService } from './autoconfirm.service';

@Controller('autoconfirm')
export class AutoconfirmController {
  constructor(private svc: AutoconfirmService) {}

  // ─── Connect Shopify ───────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('shopify/connect')
  connectStore(@Req() req: any, @Body() body: { shopDomain: string; accessToken: string }) {
    return this.svc.connectStore(req.user.id, body.shopDomain, body.accessToken);
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
    const rawBody = (req as any).rawBody as string;
    if (hmac && rawBody) {
      const valid = this.svc.verifyWebhookHmac(rawBody, hmac);
      if (!valid) return res.status(401).json({ message: 'Invalid HMAC' });
    }
    const order = req.body;
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

  // ─── Logs ──────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('logs')
  getLogs(@Req() req: any) {
    return this.svc.getLogs(req.user.id, 50);
  }
}
