import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { Snapshot } from '../snapshots/snapshot.entity';

const COUNTRY_TZ: Record<string, { tz: string; utcOffset: number }> = {
  RD: { tz: 'America/Santo_Domingo', utcOffset: 4 },
  GT: { tz: 'America/Guatemala',     utcOffset: 6 },
  EC: { tz: 'America/Guayaquil',     utcOffset: 5 },
  CR: { tz: 'America/Costa_Rica',    utcOffset: 6 },
};

function getTzCfg(country?: string) {
  return COUNTRY_TZ[country ?? 'RD'] ?? COUNTRY_TZ.RD;
}

function todayStartUTC(country?: string): Date {
  const { tz, utcOffset } = getTzCfg(country);
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  return new Date(`${dateStr}T${String(utcOffset).padStart(2, '0')}:00:00.000Z`);
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Snapshot) private snapshotRepo: Repository<Snapshot>,
  ) {}

  async getTopProducts(limit = 50, sortBy: 'today' | 'total' | 'growth' = 'today', category?: string, country?: string) {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .where('p.isActive = true');

    if (category) qb.andWhere('p.category = :category', { category });
    if (country) qb.andWhere('p.country = :country', { country });

    if (sortBy === 'growth') {
      qb.orderBy('CASE WHEN p.salesYesterday > 0 THEN (p.salesToday - p.salesYesterday)::float / p.salesYesterday ELSE p.salesToday END', 'DESC');
    } else if (sortBy === 'total') {
      qb.orderBy('p.totalSalesAccum', 'DESC');
    } else {
      qb.orderBy('p.salesToday', 'DESC');
    }

    return qb.take(limit).getMany();
  }

  async getDashboardStats(country?: string) {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .select('SUM(p.salesToday)', 'totalToday')
      .addSelect('SUM(p.salesYesterday)', 'totalYesterday')
      .addSelect('COUNT(*)', 'activeProducts')
      .where('p.isActive = true');

    if (country) qb.andWhere('p.country = :country', { country });

    const result = await qb.getRawOne();

    const today = parseInt(result.totalToday) || 0;
    const yesterday = parseInt(result.totalYesterday) || 0;
    const growth = yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 100 * 10) / 10 : 0;

    const topProducts = await this.getTopProducts(10, 'today', undefined, country);

    return { totalSalesToday: today, totalSalesYesterday: yesterday, growthPercent: growth, activeProducts: parseInt(result.activeProducts), topProducts };
  }

  async getProductById(id: string) {
    return this.productRepo.findOne({ where: { id } });
  }

  async getProductDailyHistory(id: string, days = 30) {
    const product = await this.productRepo.findOne({ where: { id }, select: ['id', 'country', 'salesToday', 'salesBaselineDate'] });
    const { tz, utcOffset } = getTzCfg(product?.country);

    // Fetch one extra day so we have a baseline for the oldest day we want to show
    const from = new Date();
    from.setDate(from.getDate() - (days + 1));
    from.setHours(0, 0, 0, 0);

    const rows = await this.snapshotRepo
      .createQueryBuilder('s')
      .select(`DATE(s."capturedAt" - INTERVAL '${utcOffset} hours')`, 'day')
      .addSelect('MAX(s.salesAccum)', 'maxAccum')
      .where('s.productId = :id', { id })
      .andWhere('s.capturedAt >= :from', { from })
      .groupBy(`DATE(s."capturedAt" - INTERVAL '${utcOffset} hours')`)
      .orderBy('day', 'ASC')
      .getRawMany();

    // MAX(day) - MAX(prev day) captures the overnight gap that MIN-based approach misses
    const salesMap = new Map<string, number>();
    for (let i = 1; i < rows.length; i++) {
      const key = typeof rows[i].day === 'string' ? rows[i].day.slice(0, 10) : new Date(rows[i].day).toISOString().slice(0, 10);
      const prev = parseInt(rows[i - 1].maxAccum) || 0;
      const curr = parseInt(rows[i].maxAccum) || 0;
      salesMap.set(key, Math.max(0, curr - prev));
    }

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });

    const result: { date: string; sales: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-CA', { timeZone: tz });
      let sales = salesMap.get(dateStr) ?? 0;
      // Today: the denormalized salesToday is always current (scraper updates it with each run)
      if (dateStr === todayStr && product?.salesBaselineDate === todayStr) {
        sales = product.salesToday ?? sales;
      }
      result.push({ date: dateStr, sales });
    }
    return result;
  }

  async getProductTodaySales(id: string) {
    const product = await this.productRepo.findOne({ where: { id }, select: ['id', 'country'] });
    const startOfDay = todayStartUTC(product?.country);

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
    country?: string,
  ) {
    const { tz, utcOffset } = getTzCfg(country);
    const intervalExpr = `'${utcOffset} hours'`;

    const qb = this.productRepo.createQueryBuilder('p').where('p.isActive = true');
    if (category) qb.andWhere('p.category = :category', { category });
    if (provider) qb.andWhere('p.provider = :provider', { provider });
    if (country) qb.andWhere('p.country = :country', { country });
    if (search) qb.andWhere('LOWER(p.name) LIKE LOWER(:q) OR LOWER(p.category) LIKE LOWER(:q) OR LOWER(p.provider) LIKE LOWER(:q)', { q: `%${search}%` });

    if (sortBy === 'winners') {
      const params: unknown[] = [];
      const conds = ['p."isActive" = true'];
      if (category) { params.push(category); conds.push(`p.category = $${params.length}`); }
      if (provider) { params.push(provider); conds.push(`p.provider = $${params.length}`); }
      if (country)  { params.push(country);  conds.push(`p.country = $${params.length}`); }
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
               DATE(s."capturedAt" - INTERVAL ${intervalExpr}) AS day,
               MAX(s."salesAccum") - MIN(s."salesAccum") AS day_sales
             FROM snapshots s
             WHERE s."capturedAt" >= NOW() - INTERVAL '7 days'
             GROUP BY s."productId", DATE(s."capturedAt" - INTERVAL ${intervalExpr})
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

      const from = new Date();
      from.setDate(from.getDate() - days);
      from.setHours(0, 0, 0, 0);
      const histRows = await this.snapshotRepo
        .createQueryBuilder('s')
        .select('s.productId', 'productId')
        .addSelect(`DATE(s."capturedAt" - INTERVAL ${intervalExpr})`, 'day')
        .addSelect('MAX(s.salesAccum) - MIN(s.salesAccum)', 'sales')
        .where('s.productId IN (:...ids)', { ids: winnerIds })
        .andWhere('s.capturedAt >= :from', { from })
        .groupBy(`s.productId, DATE(s."capturedAt" - INTERVAL ${intervalExpr})`)
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
        fullRange.push(d.toLocaleDateString('en-CA', { timeZone: tz }));
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
            GROUP BY DATE(s."capturedAt" - INTERVAL ${intervalExpr})
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

    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const ids = products.map(p => p.id);
    const rows = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('s.productId', 'productId')
      .addSelect(`DATE(s."capturedAt" - INTERVAL ${intervalExpr})`, 'day')
      .addSelect('MAX(s.salesAccum) - MIN(s.salesAccum)', 'sales')
      .where('s.productId IN (:...ids)', { ids })
      .andWhere('s.capturedAt >= :from', { from })
      .groupBy(`s.productId, DATE(s."capturedAt" - INTERVAL ${intervalExpr})`)
      .orderBy('day', 'ASC')
      .getRawMany();

    const histMap = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const dateKey = typeof r.day === 'string' ? r.day.slice(0, 10) : new Date(r.day).toISOString().slice(0, 10);
      if (!histMap.has(r.productId)) histMap.set(r.productId, new Map());
      histMap.get(r.productId)!.set(dateKey, Math.max(0, parseInt(r.sales) || 0));
    }

    const fullRange: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      fullRange.push(d.toLocaleDateString('en-CA', { timeZone: tz }));
    }

    return products.map(p => {
      const dayMap = histMap.get(p.id) ?? new Map<string, number>();
      return {
        ...p,
        dailyGrid: fullRange.map(date => ({ date, sales: dayMap.get(date) ?? 0 })),
      };
    });
  }

  async getCategories(country?: string): Promise<string[]> {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.category', 'category')
      .where('p.isActive = true AND p.category IS NOT NULL AND p.category != :empty', { empty: '' });
    if (country) qb.andWhere('p.country = :country', { country });
    const rows = await qb.orderBy('p.category', 'ASC').getRawMany();
    return rows.map(r => r.category).filter(Boolean);
  }

  async getProviders(country?: string): Promise<string[]> {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.provider', 'provider')
      .where('p.isActive = true AND p.provider IS NOT NULL AND p.provider != :empty', { empty: '' });
    if (country) qb.andWhere('p.country = :country', { country });
    const rows = await qb.orderBy('p.provider', 'ASC').getRawMany();
    return rows.map(r => r.provider).filter(Boolean);
  }

  async searchProducts(query: string, limit = 30, country?: string) {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .where('LOWER(p.name) LIKE LOWER(:q)', { q: `%${query}%` })
      .orWhere('LOWER(p.category) LIKE LOWER(:q)', { q: `%${query}%` })
      .orWhere('LOWER(p.provider) LIKE LOWER(:q)', { q: `%${query}%` });
    if (country) qb.andWhere('p.country = :country', { country });
    return qb.orderBy('p.salesToday', 'DESC').take(limit).getMany();
  }

  async refreshDailyCache() {
    // salesToday/salesYesterday are now managed by upsertProductAndSnapshot in the scraper
    // using a baseline approach per product — no snapshot recalculation needed here
  }
}
