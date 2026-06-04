import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetaConnection } from './entities/meta-connection.entity';
import { MetaCampaign } from './entities/meta-campaign.entity';
import { User } from '../users/user.entity';
import { MetaAdsService } from './meta-ads.service';
import { MetaAdsController } from './meta-ads.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MetaConnection, MetaCampaign, User])],
  providers: [MetaAdsService],
  controllers: [MetaAdsController],
})
export class MetaAdsModule {}
