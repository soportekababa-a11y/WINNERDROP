import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopifyStore } from './entities/shopify-store.entity';
import { OrderLog } from './entities/order-log.entity';
import { AutoconfirmService } from './autoconfirm.service';
import { AutoconfirmController } from './autoconfirm.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShopifyStore, OrderLog])],
  providers: [AutoconfirmService, WhatsappService],
  controllers: [AutoconfirmController],
})
export class AutoconfirmModule {}
