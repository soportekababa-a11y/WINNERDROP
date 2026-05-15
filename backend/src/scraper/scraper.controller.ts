import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('scraper')
@UseGuards(JwtAuthGuard)
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post('start')
  start() {
    this.scraperService.start();
    return { message: 'Scraper iniciado' };
  }

  @Post('stop')
  async stop() {
    await this.scraperService.stop();
    return { message: 'Scraper detenido' };
  }

  @Post('login')
  async login() {
    await this.scraperService.login();
    return { message: 'Login ejecutado' };
  }

  @Get('stats')
  stats() {
    return this.scraperService.getStats();
  }
}
