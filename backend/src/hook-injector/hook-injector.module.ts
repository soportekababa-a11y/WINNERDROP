import { Module } from '@nestjs/common';
import { HookInjectorController } from './hook-injector.controller';
import { HookInjectorService } from './hook-injector.service';

@Module({
  controllers: [HookInjectorController],
  providers: [HookInjectorService],
})
export class HookInjectorModule {}
