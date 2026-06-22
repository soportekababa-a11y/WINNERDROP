import {
  Controller, Post, Get, Param, Body, Res,
  UseGuards, UseInterceptors, UploadedFile,
  BadRequestException, NotFoundException, HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { createReadStream } from 'fs';
import { existsSync, statSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HookInjectorService, HookItem } from './hook-injector.service';

const upload = { storage: memoryStorage(), limits: { fileSize: 150 * 1024 * 1024 } };

@Controller('hook-injector')
@UseGuards(JwtAuthGuard)
export class HookInjectorController {
  constructor(private readonly svc: HookInjectorService) {}

  @Post('analyze')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('video', upload))
  async analyze(
    @UploadedFile() file: Express.Multer.File,
    @Body('productName') productName: string,
  ) {
    if (!file) throw new BadRequestException('video requerido');
    if (!productName?.trim()) throw new BadRequestException('productName requerido');
    return this.svc.analyzeVideo(file.buffer, productName.trim());
  }

  @Post('generate')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('video', upload))
  async generate(
    @UploadedFile() file: Express.Multer.File,
    @Body('hooks') hooksRaw: string,
    @Body('enableVoice') enableVoiceRaw: string,
  ) {
    if (!file) throw new BadRequestException('video requerido');
    let hooks: HookItem[];
    try { hooks = JSON.parse(hooksRaw); } catch { throw new BadRequestException('hooks must be JSON array'); }
    if (!Array.isArray(hooks) || hooks.length === 0) throw new BadRequestException('hooks vacíos');
    const enableVoice = enableVoiceRaw === 'true';
    const videos = await this.svc.generateVideos(file.buffer, hooks.slice(0, 3), enableVoice);
    return { videos };
  }

  @Get('download/:filename')
  async download(@Param('filename') filename: string, @Res() res: any) {
    const filePath = this.svc.getVideoPath(filename);
    if (!existsSync(filePath)) throw new NotFoundException('Video no encontrado');
    const stat = statSync(filePath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stat.size);
    createReadStream(filePath).pipe(res);
  }
}
