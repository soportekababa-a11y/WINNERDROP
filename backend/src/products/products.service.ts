import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { Snapshot } from '../snapshots/snapshot.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Snapshot) private snapshotRepo: Repository<Snapshot>,
  ) {}

  async getTopProducts(limit = 50, sortBy: 'today' | 'total' | 'growth' = 'today', category?: string) {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .where('p.isActive = true');

    if (category) qb.andWhere('p.category = :category', { category });

    if (sortBy === 'growth') {
      qb.orderBy('CASE WHEN p.salesYesterday > 0 THEN (p.salesToday - p.salesYesterday)::float / p.salesYesterday ELSE p.salesToday END', 'DESC');
    } else if (sortBy === 'total') {
      qb.orderBy('p.totalSalesAccum', 'DESC');
    } else {
      qb.orderBy('p.salesToday', 'DESC');
    }

    return qb.take(limit).getMany();
  }

  async getDashboardStats() {
    const result = await this.productRepo
      .createQueryBuilder('p')
      .select('SUM(p.salesToday)', 'totalToday')
      .addSelect('SUM(p.salesYesterday)', 'totalYesterday')
      .addSelect('COUNT(*)', 'activeProducts')
      .where('p.isActive = true')
      .getRawOne();

    const today = parseInt(result.totalToday) || 0;
    const yesterday = parseInt(result.totalYesterday) || 1;
    const growth = Math.round(((today - yesterday) / yesterday) * 100 * 10) / 10;

    const topProducts = await this.getTopProducts(10, 'today');

    return { totalSalesToday: today, totalSalesYesterday: yesterday, growthPercent: growth, activeProducts: parseInt(result.activeProducts), topProducts };
  }

  async getProductById(id: string) {
    return this.productRepo.findOne({ where: { id } });
  }

  // Ventas por día para un producto (historial)
  async getProductDailyHistory(id: string, days = 30) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    // Para cada día: ventas = MAX(salesAccum) del día - MIN(salesAccum) del día
    const rows = await this.snapshotRepo
      .createQueryBuilder('s')
      .select("DATE(s.capturedAt AT TIME ZONE 'America/Santo_Domingo')", 'day')
      .addSelect('MAX(s.salesAccum)', 'maxAccum')
      .addSelect('MIN(s.salesAccum)', 'minAccum')
      .where('s.productId = :id', { id })
      .andWhere('s.capturedAt >= :from', { from })
      .groupBy("DATE(s.capturedAt AT TIME ZONE 'America/Santo_Domingo')")
      .orderBy('day', 'ASC')
      .getRawMany();

    return rows.map((r, i) => ({
      date: r.day,
      sales: Math.max(0, parseInt(r.maxAccum) - parseInt(r.minAccum)),
    }));
  }

  // Ventas de hoy en tiempo real para un producto
  async getProductTodaySales(id: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const rows = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('MAX(s.salesAccum)', 'maxAccum')
      .addSelect('MIN(s.salesAccum)', 'minAccum')
      .addSelect('MAX(s.capturedAt)', 'lastUpdate')
      .where('s.productId = :id', { id })
      .andWhere('s.capturedAt >= :startOfDay', { startOfDay })
      .getRawOne();

    return {
      salesToday: Math.max(0, parseInt(rows?.maxAccum ?? 0) - parseInt(rows?.minAccum ?? 0)),
      lastUpdate: rows?.lastUpdate ?? null,
    };
  }

  async getProductsWithDailyGrid(
    limit = 40,
    sortBy: 'today' | 'total' | 'growth' = 'today',
    days = 14,
    category?: string,
    search?: string,
    offset = 0,
    hot = false,
  ) {
    // 1. Get products
    const qb = this.productRepo.createQueryBuilder('p').where('p.isActive = true');
    if (category) qb.andWhere('p.category = :category', { category });
    if (search) qb.andWhere('LOWER(p.name) LIKE LOWER(:q) OR LOWER(p.category) LIKE LOWER(:q) OR LOWER(p.provider) LIKE LOWER(:q)', { q: `%${search}%` });

    if (hot) {
      // "Más vendidos": al menos 7 ventas en el día de hoy o ayer,
      // O un acumulado semanal significativo (salesYesterday+salesToday >= 10)
      qb.andWhere(
        '(p.salesToday >= 7 OR p.salesYesterday >= 7 OR (p.salesToday + p.salesYesterday) >= 10)',
      );
    }

    if (sortBy === 'growth') {
      qb.orderBy('CASE WHEN p.salesYesterday > 0 THEN (p.salesToday - p.salesYesterday)::float / p.salesYesterday ELSE p.salesToday END', 'DESC');
    } else if (sortBy === 'total') {
      qb.orderBy('p.totalSalesAccum', 'DESC');
    } else {
      qb.orderBy('p.salesToday', 'DESC');
    }
    const products = await qb.skip(offset).take(limit).getMany();
    if (!products.length) return [];

    // 2. Bulk daily history for all products in one query
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const ids = products.map(p => p.id);
    const rows = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('s.productId', 'productId')
      .addSelect("DATE(s.capturedAt AT TIME ZONE 'America/Santo_Domingo')", 'day')
      .addSelect('MAX(s.salesAccum) - MIN(s.salesAccum)', 'sales')
      .where('s.productId IN (:...ids)', { ids })
      .andWhere('s.capturedAt >= :from', { from })
      .groupBy("s.productId, DATE(s.capturedAt AT TIME ZONE 'America/Santo_Domingo')")
      .orderBy('day', 'ASC')
      .getRawMany();

    // 3. Build map productId -> day -> sales
    const histMap = new Map<string, { date: string; sales: number }[]>();
    for (const r of rows) {
      if (!histMap.has(r.productId)) histMap.set(r.productId, []);
      histMap.get(r.productId)!.push({ date: r.day, sales: Math.max(0, parseInt(r.sales) || 0) });
    }

    return products.map(p => ({
      ...p,
      dailyGrid: histMap.get(p.id) ?? [],
    }));
  }

  async getCategories(): Promise<string[]> {
    const rows = await this.productRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.category', 'category')
      .where('p.isActive = true AND p.category IS NOT NULL AND p.category != :empty', { empty: '' })
      .orderBy('p.category', 'ASC')
      .getRawMany();
    return rows.map(r => r.category).filter(Boolean);
  }

  async searchProducts(query: string, limit = 30) {
    return this.productRepo
      .createQueryBuilder('p')
      .where('LOWER(p.name) LIKE LOWER(:q)', { q: `%${query}%` })
      .orWhere('LOWER(p.category) LIKE LOWER(:q)', { q: `%${query}%` })
      .orWhere('LOWER(p.provider) LIKE LOWER(:q)', { q: `%${query}%` })
      .orderBy('p.salesToday', 'DESC')
      .take(limit)
      .getMany();
  }

  // Recalcula salesToday y salesYesterday desde snapshots (se llama cada ciclo)
  async refreshDailyCache() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    // Calcular ventas de hoy por producto
    const todayRows: { productId: string; sales: string }[] = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('s.productId', 'productId')
      .addSelect('MAX(s.salesAccum) - MIN(s.salesAccum)', 'sales')
      .where('s.capturedAt >= :todayStart', { todayStart })
      .groupBy('s.productId')
      .getRawMany();

    // Calcular ventas de ayer por producto
    const yesterdayRows: { productId: string; sales: string }[] = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('s.productId', 'productId')
      .addSelect('MAX(s.salesAccum) - MIN(s.salesAccum)', 'sales')
      .where('s.capturedAt >= :yesterdayStart AND s.capturedAt < :todayStart', { yesterdayStart, todayStart })
      .groupBy('s.productId')
      .getRawMany();

    const todayMap = new Map(todayRows.map(r => [r.productId, Math.max(0, parseInt(r.sales))]));
    const yesterdayMap = new Map(yesterdayRows.map(r => [r.productId, Math.max(0, parseInt(r.sales))]));

    // Actualizar en lotes
    const products = await this.productRepo.find({ select: ['id'] });
    for (const p of products) {
      const today = todayMap.get(p.id) ?? 0;
      const yesterday = yesterdayMap.get(p.id) ?? 0;
      if (today !== undefined) {
        await this.productRepo.update(p.id, { salesToday: today, salesYesterday: yesterday });
      }
    }
  }
}
