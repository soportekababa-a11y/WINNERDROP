import { Controller, Post, Body, Req, UseGuards, UseInterceptors, UploadedFile, HttpCode } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdsIntelligenceService } from './ads-intelligence.service';

@Controller('ads-intelligence')
@UseGuards(JwtAuthGuard)
export class AdsIntelligenceController {
  constructor(private readonly svc: AdsIntelligenceService) {}

  @Post('analyze')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async analyze(
    @Req() req: any,
    @UploadedFile() imageFile: Express.Multer.File | undefined,
    @Body('productName') productName: string,
    @Body('country') country: string,
    @Body('forceRefresh') forceRefreshRaw?: string,
  ) {
    if (!productName?.trim()) throw new Error('productName requerido');
    if (!country?.trim()) throw new Error('country requerido');

    const imageBase64 = imageFile
      ? imageFile.buffer.toString('base64')
      : null;

    return this.svc.analyze(
      productName.trim(),
      imageBase64,
      country.trim(),
      req.user.id,
      forceRefreshRaw === 'true',
    );
  }
}
