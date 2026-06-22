import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdsIntelligenceController } from './ads-intelligence.controller';
import { AdsIntelligenceService } from './ads-intelligence.service';
import { AdIntelligenceCache } from './entities/ad-intelligence-cache.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AdIntelligenceCache])],
  controllers: [AdsIntelligenceController],
  providers: [AdsIntelligenceService],
})
export class AdsIntelligenceModule {}
