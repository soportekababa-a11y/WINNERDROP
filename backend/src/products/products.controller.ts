import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('categories')
  getCategories(@Query('country') country?: string) {
    return this.productsService.getCategories(country);
  }

  @Get('providers')
  getProviders(@Query('country') country?: string) {
    return this.productsService.getProviders(country);
  }

  @Get()
  getTopProducts(
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('country') country?: string,
  ) {
    if (search) return this.productsService.searchProducts(search, limit ? parseInt(limit) : 30, country);
    return this.productsService.getTopProducts(
      limit ? parseInt(limit) : 50,
      (sort as any) ?? 'today',
      category,
      country,
    );
  }

  @Get('grid')
  getProductsGrid(
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('days') days?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('offset') offset?: string,
    @Query('hot') hot?: string,
    @Query('provider') provider?: string,
    @Query('country') country?: string,
  ) {
    return this.productsService.getProductsWithDailyGrid(
      limit ? parseInt(limit) : 40,
      (sort as 'today' | 'total' | 'growth' | 'winners') ?? 'today',
      days ? parseInt(days) : 14,
      category,
      search,
      offset ? parseInt(offset) : 0,
      hot === 'true',
      provider,
      country,
    );
  }

  @Get('dashboard')
  getDashboardStats(@Query('country') country?: string) {
    return this.productsService.getDashboardStats(country);
  }

  @Get(':id/daily')
  getDailyHistory(
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    return this.productsService.getProductDailyHistory(id, days ? parseInt(days) : 30);
  }

  @Get(':id/today')
  getTodaySales(@Param('id') id: string) {
    return this.productsService.getProductTodaySales(id);
  }

  @Get(':id')
  getProduct(@Param('id') id: string) {
    return this.productsService.getProductById(id);
  }
}
