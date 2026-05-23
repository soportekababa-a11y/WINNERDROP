import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopifyStore } from './entities/shopify-store.entity';
import { OrderLog } from './entities/order-log.entity';
import { AutoconfirmService } from './autoconfirm.service';
import { AutoconfirmController } from './autoconfirm.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ShopifyStore, OrderLog])],
  providers: [AutoconfirmService],
  controllers: [AutoconfirmController],
})
export class AutoconfirmModule {}
