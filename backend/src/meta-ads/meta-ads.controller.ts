import { Controller, Get, Post, Delete, Body, Req, Param, UseGuards, UseInterceptors, UploadedFiles, HttpCode } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MetaAdsService } from './meta-ads.service';

@Controller('meta-ads')
export class MetaAdsController {
  constructor(private svc: MetaAdsService) {}

  @UseGuards(JwtAuthGuard) @Get('auth-url')
  getAuthUrl(@Req() req: any) { return { url: this.svc.getAuthUrl(req.user.id) }; }

  @Post('connect') @HttpCode(200)
  async connect(@Body() body: { code: string; state: string }) {
    await this.svc.handleCallback(body.code, body.state);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard) @Get('status')
  getStatus(@Req() req: any) { return this.svc.getStatus(req.user.id); }

  @UseGuards(JwtAuthGuard) @Delete('disconnect')
  disconnect(@Req() req: any) { return this.svc.disconnect(req.user.id); }

  @UseGuards(JwtAuthGuard) @Get('accounts')
  getAdAccounts(@Req() req: any) { return this.svc.getAdAccounts(req.user.id); }

  @UseGuards(JwtAuthGuard) @Post('select-account')
  selectAccount(@Req() req: any, @Body() body: { adAccountId: string; adAccountName: string }) {
    return this.svc.selectAdAccount(req.user.id, body.adAccountId, body.adAccountName);
  }

  @UseGuards(JwtAuthGuard) @Get('pages')
  getPages(@Req() req: any) { return this.svc.getPages(req.user.id); }

  @UseGuards(JwtAuthGuard) @Post('select-page')
  selectPage(@Req() req: any, @Body() body: { pageId: string; pageName: string }) {
    return this.svc.selectPage(req.user.id, body.pageId, body.pageName);
  }

  @UseGuards(JwtAuthGuard) @Get('pixels')
  getPixels(@Req() req: any) { return this.svc.getPixels(req.user.id); }

  @UseGuards(JwtAuthGuard) @Get('pixels/:pixelId/events')
  getPixelEvents(@Req() req: any, @Param('pixelId') pixelId: string) {
    return this.svc.getPixelEvents(req.user.id, pixelId);
  }

  @UseGuards(JwtAuthGuard) @Get('instagram')
  getInstagram(@Req() req: any) { return this.svc.getInstagramAccounts(req.user.id); }

  @UseGuards(JwtAuthGuard) @Post('suggest-names')
  suggestNames(@Req() req: any, @Body() body: { productName: string; country: string; campaignType: string }) {
    return this.svc.suggestProductNames(body.productName, body.country, body.campaignType);
  }

  @UseGuards(JwtAuthGuard) @Post('research-product')
  researchProduct(@Req() req: any, @Body() body: any) {
    return this.svc.researchProduct(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard) @Post('suggest-audience')
  suggestAudience(@Req() req: any, @Body() body: any) {
    return this.svc.suggestAudience(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard) @Post('generate-copy')
  generateCopy(@Req() req: any, @Body() body: any) {
    return this.svc.generateCopy(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard) @Get('campaigns')
  getCampaigns(@Req() req: any) { return this.svc.getCampaigns(req.user.id); }

  @UseGuards(JwtAuthGuard) @Post('analyze-metrics')
  analyzeMetrics(@Req() req: any, @Body() body: { fbCampaignId: string; campaignId: string }) {
    return this.svc.analyzeMetrics(req.user.id, body.fbCampaignId, body.campaignId);
  }

  @UseGuards(JwtAuthGuard) @Post('scale-options')
  getScaleOptions(@Req() req: any, @Body() body: { fbCampaignId: string; fbAdSetId: string }) {
    return this.svc.getScaleOptions(req.user.id, body.fbCampaignId, body.fbAdSetId);
  }

  @UseGuards(JwtAuthGuard) @Post('scale-execute')
  executeScale(@Req() req: any, @Body() body: { fbCampaignId: string; fbAdSetId: string; scaleType: string; params: any }) {
    return this.svc.executeScale(req.user.id, body.fbCampaignId, body.fbAdSetId, body.scaleType, body.params);
  }

  @UseGuards(JwtAuthGuard) @Post('chat')
  chat(@Req() req: any, @Body() body: { messages: { role: string; content: string }[] }) {
    return this.svc.chatSession(req.user.id, body.messages);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns')
  @UseInterceptors(FilesInterceptor('files', 10, { storage: memoryStorage() }))
  createCampaign(@Req() req: any, @UploadedFiles() files: Express.Multer.File[], @Body() body: any) {
    return this.svc.createCampaign(req.user.id, {
      campaignType: body.campaignType,
      productName: body.productName,
      landingPage: body.landingPage,
      country: body.country,
      dailyBudget: parseFloat(body.dailyBudget),
      budgetType: body.budgetType ?? 'ABO',
      adSetsCount: body.adSetsCount ? parseInt(body.adSetsCount) : 1,
      priceBefore: body.priceBefore || undefined,
      priceAfter: body.priceAfter || undefined,
      pixelId: body.pixelId || undefined,
      conversionEvent: body.conversionEvent || undefined,
      startTime: body.startTime ?? 'now',
      excludeCities: body.excludeCities ? JSON.parse(body.excludeCities) : [],
      instagramAccountId: body.instagramAccountId || undefined,
      strategy: body.strategy || undefined,
      audienceHint: body.audienceHint || undefined,
      productDescription: body.productDescription || undefined,
      audienceAdSets: body.audienceAdSets ? JSON.parse(body.audienceAdSets) : [],
      copys: body.copys ? JSON.parse(body.copys) : [],
    }, files);
  }
}
