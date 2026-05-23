import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({ origin: true });
  app.use('/autoconfirm/shopify/webhook', express.raw({ type: 'application/json' }));
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
