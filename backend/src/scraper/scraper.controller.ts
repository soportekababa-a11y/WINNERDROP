import { Controller, Post, Get } from '@nestjs/common';
import { ScraperService } from './scraper.service';

@Controller('scraper')
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
