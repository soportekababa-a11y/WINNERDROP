import {
  Controller, Get, Post, Put, Delete, Query, Body, Req, Res,
  UseGuards, HttpCode, Headers, RawBodyRequest,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutoconfirmService } from './autoconfirm.service';

@Controller('autoconfirm')
export class AutoconfirmController {
  constructor(private svc: AutoconfirmService) {}

  // ─── Shopify OAuth ─────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('shopify/install')
  install(@Req() req: any, @Query('shop') shop: string, @Res() res: Response) {
    if (!shop) return res.status(400).json({ message: 'Missing shop param' });
    const url = this.svc.getInstallUrl(req.user.id, shop);
    return res.json({ url });
  }

  @Get('shopify/callback')
  async callback(
    @Query('code') code: string,
    @Query('shop') shop: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.svc.handleCallback(code, shop, state);
    return res.redirect(redirectUrl);
  }

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
  updateTemplate(
    @Req() req: any,
    @Body() body: { messageTemplate?: string; whatsappTemplateName?: string; whatsappLanguage?: string; whatsappEnabled?: boolean },
  ) {
    return this.svc.updateTemplate(req.user.id, body);
  }

  // ─── Logs ──────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('logs')
  getLogs(@Req() req: any, @Query('limit') limit?: string) {
    return this.svc.getLogs(req.user.id, limit ? Number(limit) : 50);
  }
}
