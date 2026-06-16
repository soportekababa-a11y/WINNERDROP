import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScraperService } from './scraper.service';
import { DropisService } from './dropi.service';
import { ScraperController } from './scraper.controller';
import { Product } from '../products/product.entity';
import { Snapshot } from '../snapshots/snapshot.entity';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Snapshot]), ProductsModule],
  providers: [ScraperService, DropisService],
  controllers: [ScraperController],
  exports: [ScraperService, DropisService],
})
export class ScraperModule {}
