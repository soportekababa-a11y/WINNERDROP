import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CompetitorSpyService } from './competitor-spy.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';

@Controller('competitor-spy')
@UseGuards(JwtAuthGuard)
export class CompetitorSpyController {
  constructor(
    private readonly spyService: CompetitorSpyService,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  @Get(':productId')
  async analyze(@Param('productId') productId: string) {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) return { competitors: [] };
    return this.spyService.findCompetitors(product.name);
  }
}
