import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/product.entity';
import { ImageSearchProvider } from './providers/image-search.provider';
import { CompetitorSpyService } from './competitor-spy.service';
import { CompetitorSpyController } from './competitor-spy.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  providers: [ImageSearchProvider, CompetitorSpyService],
  controllers: [CompetitorSpyController],
})
export class CompetitorSpyModule {}
