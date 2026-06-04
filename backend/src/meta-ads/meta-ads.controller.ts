import { Controller, Get, Post, Delete, Body, Req, Res, Query, UseGuards, UseInterceptors, UploadedFiles, HttpCode } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MetaAdsService } from './meta-ads.service';

@Controller('meta-ads')
export class MetaAdsController {
  constructor(private svc: MetaAdsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('auth-url')
  getAuthUrl(@Req() req: any) {
    return { url: this.svc.getAuthUrl(req.user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('connect')
  @HttpCode(200)
  async connect(@Body() body: { code: string; state: string }) {
    await this.svc.handleCallback(body.code, body.state);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  getStatus(@Req() req: any) {
    return this.svc.getStatus(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('disconnect')
  disconnect(@Req() req: any) {
    return this.svc.disconnect(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('accounts')
  getAdAccounts(@Req() req: any) {
    return this.svc.getAdAccounts(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('select-account')
  selectAccount(@Req() req: any, @Body() body: { adAccountId: string; adAccountName: string }) {
    return this.svc.selectAdAccount(req.user.id, body.adAccountId, body.adAccountName);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pages')
  getPages(@Req() req: any) {
    return this.svc.getPages(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('select-page')
  selectPage(@Req() req: any, @Body() body: { pageId: string; pageName: string }) {
    return this.svc.selectPage(req.user.id, body.pageId, body.pageName);
  }

  @UseGuards(JwtAuthGuard)
  @Get('campaigns')
  getCampaigns(@Req() req: any) {
    return this.svc.getCampaigns(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('metrics')
  getMetrics(@Req() req: any) {
    return this.svc.getCampaignMetrics(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns')
  @UseInterceptors(FilesInterceptor('files', 10, { storage: memoryStorage() }))
  createCampaign(
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any,
  ) {
    const dto = {
      campaignType: body.campaignType,
      productName: body.productName,
      landingPage: body.landingPage,
      country: body.country,
      excludeCities: body.excludeCities ? JSON.parse(body.excludeCities) : [],
      dailyBudget: parseFloat(body.dailyBudget),
      startTime: body.startTime ?? 'now',
      campaignMode: body.campaignMode,
      budgetType: body.budgetType,
      angleMode: body.angleMode,
      customAngle: body.customAngle,
      adSetsCount: body.adSetsCount,
    };
    return this.svc.createCampaign(req.user.id, dto, files);
  }
}
