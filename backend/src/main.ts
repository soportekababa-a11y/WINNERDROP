import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: ['http://localhost:3000', 'http://10.0.0.14:3000'] });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
