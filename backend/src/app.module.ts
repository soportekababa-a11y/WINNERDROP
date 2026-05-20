import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './products/product.entity';
import { Snapshot } from './snapshots/snapshot.entity';
import { User } from './users/user.entity';
import { ProductsModule } from './products/products.module';
import { ScraperModule } from './scraper/scraper.module';
import { ScraperService } from './scraper/scraper.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompetitorSpyModule } from './competitor-spy/competitor-spy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_DATABASE', 'winnerdrop'),
        entities: [Product, Snapshot, User],
        synchronize: true,
        logging: false,
      }),
    }),
    ProductsModule,
    ScraperModule,
    AuthModule,
    UsersModule,
    CompetitorSpyModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private scraperService: ScraperService) {}

  onModuleInit() {
    this.scraperService.start();
  }
}
