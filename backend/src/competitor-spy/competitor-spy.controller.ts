import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CompetitorSpyService } from './competitor-spy.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { DEFAULT_MARKET } from './config/markets.config';
import { DEFAULT_PLATFORM } from './config/platforms.config';

@Controller('competitor-spy')
@UseGuards(JwtAuthGuard)
export class CompetitorSpyController {
  constructor(
    private readonly spyService: CompetitorSpyService,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  @Get(':productId')
  async analyze(
    @Param('productId') productId: string,
    @Query('market') market = DEFAULT_MARKET,
    @Query('platform') platform = DEFAULT_PLATFORM,
  ) {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) return { error: 'Producto no encontrado' };

    return this.spyService.analyzeProduct(product.name, market, platform);
  }
}
