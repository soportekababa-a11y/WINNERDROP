import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true, bodyParser: false });
  app.use((req: any, res: any, next: any) => {
    const ct = req.headers['content-type'] ?? '';
    if (ct.includes('multipart/form-data')) return next();
    express.json({ limit: '50mb' })(req, res, (err: any) => {
      if (err) return next(err);
      express.urlencoded({ limit: '50mb', extended: true })(req, res, next);
    });
  });
  app.enableCors({ origin: true });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
