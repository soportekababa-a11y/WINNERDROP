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
    const yesterday = parseInt(result.totalYesterday) || 0;
    const growth = yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 100 * 10) / 10 : 0;

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
      .select("DATE(s.capturedAt - INTERVAL '4 hours')", 'day')
      .addSelect('MAX(s.salesAccum)', 'maxAccum')
      .addSelect('MIN(s.salesAccum)', 'minAccum')
      .where('s.productId = :id', { id })
      .andWhere('s.capturedAt >= :from', { from })
      .groupBy("DATE(s.capturedAt - INTERVAL '4 hours')")
      .orderBy('day', 'ASC')
      .getRawMany();

    // Build a full date range so days with 0 sales are included
    const salesMap = new Map<string, number>();
    for (const r of rows) {
      const key = typeof r.day === 'string' ? r.day.slice(0, 10) : new Date(r.day).toISOString().slice(0, 10);
      salesMap.set(key, Math.max(0, parseInt(r.maxAccum) - parseInt(r.minAccum)));
    }

    const result: { date: string; sales: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' });
      result.push({ date: dateStr, sales: salesMap.get(dateStr) ?? 0 });
    }
    return result;
  }

  // Ventas de hoy en tiempo real para un producto
  async getProductTodaySales(id: string) {
    const rdDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' });
    const startOfDay = new Date(rdDateStr + 'T04:00:00.000Z');

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
    sortBy: 'today' | 'total' | 'growth' | 'winners' = 'today',
    days = 14,
    category?: string,
    search?: string,
    offset = 0,
    hot = false,
    provider?: string,
  ) {
    // 1. Get products
    const qb = this.productRepo.createQueryBuilder('p').where('p.isActive = true');
    if (category) qb.andWhere('p.category = :category', { category });
    if (provider) qb.andWhere('p.provider = :provider', { provider });
    if (search) qb.andWhere('LOWER(p.name) LIKE LOWER(:q) OR LOWER(p.category) LIKE LOWER(:q) OR LOWER(p.provider) LIKE LOWER(:q)', { q: `%${search}%` });

    if (sortBy === 'winners') {
      // Two-step to avoid TypeORM alias resolution error on raw subquery ORDER BY
      const params: unknown[] = [];
      const conds = ['p."isActive" = true'];
      if (category) { params.push(category); conds.push(`p.category = $${params.length}`); }
      if (provider) { params.push(provider); conds.push(`p.provider = $${params.length}`); }
      if (search) {
        params.push(`%${search}%`);
        const n = params.length;
        conds.push(`(LOWER(p.name) LIKE LOWER($${n}) OR LOWER(p.category) LIKE LOWER($${n}) OR LOWER(p.provider) LIKE LOWER($${n}))`);
      }
      params.push(limit, offset);
      const lp = params.length;
      const winnerRows: { id: string }[] = await this.productRepo.manager.query(
        `SELECT p.id FROM products p
         INNER JOIN (
           SELECT daily."productId" AS pid,
             SUM(CASE WHEN daily.day_sales > 0 THEN 1 ELSE 0 END) AS days_active,
             SUM(daily.day_sales) AS total_week
           FROM (
             SELECT s."productId",
               DATE(s."capturedAt" - INTERVAL '4 hours') AS day,
               MAX(s."salesAccum") - MIN(s."salesAccum") AS day_sales
             FROM snapshots s
             WHERE s."capturedAt" >= NOW() - INTERVAL '7 days'
             GROUP BY s."productId", DATE(s."capturedAt" - INTERVAL '4 hours')
           ) daily
           GROUP BY daily."productId"
           HAVING SUM(CASE WHEN daily.day_sales > 0 THEN 1 ELSE 0 END) >= 2
         ) w ON w.pid = p.id
         WHERE ${conds.join(' AND ')}
         ORDER BY w.days_active DESC, w.total_week DESC
         LIMIT $${lp - 1} OFFSET $${lp}`,
        params,
      );
      if (!winnerRows.length) return [];
      const winnerIds = winnerRows.map(r => r.id);
      const fetched = await this.productRepo
        .createQueryBuilder('p')
        .where('p.id IN (:...ids)', { ids: winnerIds })
        .getMany();
      const order = new Map(winnerIds.map((id, i) => [id, i]));
      const products = fetched.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));

      // Steps 2-4 inline for winners path
      const from = new Date();
      from.setDate(from.getDate() - days);
      from.setHours(0, 0, 0, 0);
      const histRows = await this.snapshotRepo
        .createQueryBuilder('s')
        .select('s.productId', 'productId')
        .addSelect("DATE(s.capturedAt - INTERVAL '4 hours')", 'day')
        .addSelect('MAX(s.salesAccum) - MIN(s.salesAccum)', 'sales')
        .where('s.productId IN (:...ids)', { ids: winnerIds })
        .andWhere('s.capturedAt >= :from', { from })
        .groupBy("s.productId, DATE(s.capturedAt - INTERVAL '4 hours')")
        .orderBy('day', 'ASC')
        .getRawMany();
      const histMap = new Map<string, Map<string, number>>();
      for (const r of histRows) {
        const dateKey = typeof r.day === 'string' ? r.day.slice(0, 10) : new Date(r.day).toISOString().slice(0, 10);
        if (!histMap.has(r.productId)) histMap.set(r.productId, new Map());
        histMap.get(r.productId)!.set(dateKey, Math.max(0, parseInt(r.sales) || 0));
      }
      const fullRange: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        fullRange.push(d.toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' }));
      }
      return products.map(p => {
        const dayMap = histMap.get(p.id) ?? new Map<string, number>();
        return { ...p, dailyGrid: fullRange.map(date => ({ date, sales: dayMap.get(date) ?? 0 })) };
      });
    } else if (hot) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM (
            SELECT MAX(s."salesAccum") - MIN(s."salesAccum") AS daily_sales
            FROM snapshots s
            WHERE s."productId" = p.id
              AND s."capturedAt" >= NOW() - INTERVAL '2 days'
            GROUP BY DATE(s."capturedAt" - INTERVAL '4 hours')
          ) sub WHERE sub.daily_sales >= 7
        )`,
      );
      qb.orderBy('p.salesToday', 'DESC');
    } else if (sortBy === 'growth') {
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
      .addSelect("DATE(s.capturedAt - INTERVAL '4 hours')", 'day')
      .addSelect('MAX(s.salesAccum) - MIN(s.salesAccum)', 'sales')
      .where('s.productId IN (:...ids)', { ids })
      .andWhere('s.capturedAt >= :from', { from })
      .groupBy("s.productId, DATE(s.capturedAt - INTERVAL '4 hours')")
      .orderBy('day', 'ASC')
      .getRawMany();

    // 3. Build map productId -> dateStr -> sales
    const histMap = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const dateKey = typeof r.day === 'string' ? r.day.slice(0, 10) : new Date(r.day).toISOString().slice(0, 10);
      if (!histMap.has(r.productId)) histMap.set(r.productId, new Map());
      histMap.get(r.productId)!.set(dateKey, Math.max(0, parseInt(r.sales) || 0));
    }

    // 4. Full date range in RD timezone so grid[last] is always today
    const fullRange: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      fullRange.push(d.toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' }));
    }

    return products.map(p => {
      const dayMap = histMap.get(p.id) ?? new Map<string, number>();
      return {
        ...p,
        dailyGrid: fullRange.map(date => ({ date, sales: dayMap.get(date) ?? 0 })),
      };
    });
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

  async getProviders(): Promise<string[]> {
    const rows = await this.productRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.provider', 'provider')
      .where('p.isActive = true AND p.provider IS NOT NULL AND p.provider != :empty', { empty: '' })
      .orderBy('p.provider', 'ASC')
      .getRawMany();
    return rows.map(r => r.provider).filter(Boolean);
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
    // RD is always UTC-4 (no DST). Midnight RD = 04:00 UTC.
    const rdDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' }); // YYYY-MM-DD
    const todayStart = new Date(rdDateStr + 'T04:00:00.000Z');
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

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
