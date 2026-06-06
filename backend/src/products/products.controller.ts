import { Controller, Get, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type ReqUser = { id: string; plan: string; selectedCountry: string | null; planExpiresAt: Date | null };

function effectiveCountry(user: ReqUser, requested?: string): string | undefined {
  if (user.plan === 'free') throw new ForbiddenException('PLAN_REQUIRED');
  if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date()) throw new ForbiddenException('PLAN_EXPIRED');
  if (user.plan === 'basic') return user.selectedCountry ?? requested;
  return requested;
}

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('categories')
  getCategories(@Request() req: any, @Query('country') country?: string, @Query('platform') platform?: string) {
    return this.productsService.getCategories(effectiveCountry(req.user, country), platform);
  }

  @Get('providers')
  getProviders(@Request() req: any, @Query('country') country?: string, @Query('platform') platform?: string) {
    return this.productsService.getProviders(effectiveCountry(req.user, country), platform);
  }

  @Get()
  getTopProducts(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('country') country?: string,
  ) {
    const c = effectiveCountry(req.user, country);
    if (search) return this.productsService.searchProducts(search, limit ? parseInt(limit) : 30, c);
    return this.productsService.getTopProducts(limit ? parseInt(limit) : 50, (sort as any) ?? 'today', category, c);
  }

  @Get('grid')
  getProductsGrid(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('days') days?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('offset') offset?: string,
    @Query('hot') hot?: string,
    @Query('provider') provider?: string,
    @Query('country') country?: string,
    @Query('platform') platform?: string,
  ) {
    const c = effectiveCountry(req.user, country);
    return this.productsService.getProductsWithDailyGrid(
      limit ? parseInt(limit) : 40,
      (sort as 'today' | 'total' | 'growth' | 'winners' | 'yesterday') ?? 'yesterday',
      days ? parseInt(days) : 14,
      category,
      search,
      offset ? parseInt(offset) : 0,
      hot === 'true',
      provider,
      c,
      platform,
    );
  }

  @Get('dashboard')
  getDashboardStats(@Request() req: any, @Query('country') country?: string, @Query('platform') platform?: string) {
    return this.productsService.getDashboardStats(effectiveCountry(req.user, country), platform);
  }

  @Get(':id/daily')
  getDailyHistory(@Request() req: any, @Param('id') id: string, @Query('days') days?: string) {
    if (req.user.plan === 'free') throw new ForbiddenException('PLAN_REQUIRED');
    return this.productsService.getProductDailyHistory(id, days ? parseInt(days) : 30);
  }

  @Get(':id/today')
  getTodaySales(@Request() req: any, @Param('id') id: string) {
    if (req.user.plan === 'free') throw new ForbiddenException('PLAN_REQUIRED');
    return this.productsService.getProductTodaySales(id);
  }

  @Get(':id')
  getProduct(@Request() req: any, @Param('id') id: string) {
    if (req.user.plan === 'free') throw new ForbiddenException('PLAN_REQUIRED');
    return this.productsService.getProductById(id);
  }
}
