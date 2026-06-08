import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { Snapshot } from '../snapshots/snapshot.entity';

const CDN = 'https://d3sk39qh2f4j46.cloudfront.net/';
const PAGE_SIZE = 100;

function businessDay(): string {
  const now = new Date();
  const adj = new Date(now);
  if (now.getUTCHours() < 7) adj.setUTCDate(adj.getUTCDate() - 1);
  return adj.toISOString().slice(0, 10);
}

export const DROPI_COUNTRIES = [
  { code: 'CR', apiBase: 'https://api.dropi.cr', countryKey: 'COSTARICA' },
];

interface DropiRaw {
  dropiId: string;
  name: string;
  imageUrl: string;
  provider: string;
  category: string;
  subcategory: string;
  price: number;
  cost: number;
  stock: number;
}

@Injectable()
export class DropisService {
  private readonly logger = new Logger(DropisService.name);

  constructor(
    private config: ConfigService,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Snapshot) private snapshotRepo: Repository<Snapshot>,
  ) {}

  async scrapeCountry(def: typeof DROPI_COUNTRIES[0]): Promise<{ saved: number }> {
    const email    = this.config.get<string>('DROPI_EMAIL')!;
    const password = this.config.get<string>('DROPI_PASSWORD')!;
    const { code, apiBase, countryKey } = def;

    const token = await this.login(apiBase, email, password, code);
    if (!token) { this.logger.error(`[Dropi:${code}] Login fallido`); return { saved: 0 }; }
    this.logger.log(`[Dropi:${code}] Token OK — fetching products...`);

    const products = await this.fetchAll(apiBase, token, countryKey, code);
    this.logger.log(`[Dropi:${code}] ${products.length} productos`);

    let saved = 0;
    const yesterdayUpdates: { id: string; salesYesterday: number }[] = [];

    for (const raw of products) {
      try {
        const pending = await this.upsert(raw, code);
        if (pending) yesterdayUpdates.push(pending);
        saved++;
      } catch (err) {
        this.logger.error(`[Dropi:${code}] Error ${raw.dropiId}: ${err}`);
      }
    }

    // Batch salesYesterday at end of country cycle
    if (yesterdayUpdates.length > 0) {
      this.logger.log(`[Dropi:${code}] Actualizando ventas ayer: ${yesterdayUpdates.length}`);
      await Promise.all(
        yesterdayUpdates.map(({ id, salesYesterday }) =>
          this.productRepo.update(id, { salesYesterday }).catch(() => {}),
        ),
      );
    }

    this.logger.log(`[Dropi:${code}] ${saved}/${products.length} guardados`);
    return { saved };
  }

  private async login(apiBase: string, email: string, password: string, code: string): Promise<string | null> {
    const appDomain = apiBase.replace('api.', 'app.');
    try {
      const res = await fetch(`${apiBase}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Origin': appDomain,
          'Referer': `${appDomain}/auth/login`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`[Dropi:${code}] Login HTTP ${res.status} — ${body.slice(0, 200)}`);
        return null;
      }
      const data = await res.json() as any;
      if (!data.token) this.logger.warn(`[Dropi:${code}] Login OK pero sin token — keys: ${Object.keys(data).join(', ')}`);
      return data.token ?? null;
    } catch (err) {
      this.logger.error(`[Dropi:${code}] Login error`, err);
      return null;
    }
  }

  private async fetchAll(apiBase: string, token: string, countryKey: string, code: string): Promise<DropiRaw[]> {
    const all: DropiRaw[] = [];
    let start = 0;

    while (true) {
      const resp = await fetch(`${apiBase}/api/products/v4/index`, {
        method: 'POST',
        headers: { 'x-authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageSize: PAGE_SIZE, startData: start,
          privated_product: false, userVerified: false, favorite: false,
          with_collection: true, get_stock: true, no_count: true,
          search_type: 'simple', country: countryKey,
        }),
      }).then(r => r.json()) as any;

      const items: any[] = resp.objects ?? [];
      if (!items.length) break;

      if (start === 0 && items.length > 0) {
        this.logger.log(`[Dropi:${code}] SAMPLE_ITEM_KEYS: ${Object.keys(items[0]).join(', ')}`);
        this.logger.log(`[Dropi:${code}] SAMPLE_ITEM: ${JSON.stringify(items[0])}`);
      }

      for (const item of items) {
        const imageUrl = item.gallery?.[0]?.urlS3 ? `${CDN}${item.gallery[0].urlS3}` : '';
        const rawStock = item.warehouse_product?.[0]?.stock ?? 0;
        const stock    = rawStock > 100_000_000 ? 0 : rawStock; // skip "unlimited" virtual stock
        all.push({
          dropiId: `dropi_${item.id}`,
          name: item.name ?? '',
          imageUrl,
          provider: item.user?.name ?? '',
          category: item.categories?.[0]?.name ?? '',
          subcategory: item.categories?.[1]?.name ?? '',
          price: item.suggested_price ?? 0,
          cost: item.sale_price ?? 0,
          stock,
        });
      }

      this.logger.log(`[Dropi:${code}] Fetched ${all.length} (start=${start})`);
      if (items.length < PAGE_SIZE) break;
      start += PAGE_SIZE;
    }

    return all;
  }

  private async upsert(raw: DropiRaw, country: string): Promise<{ id: string; salesYesterday: number } | null> {
    const today = businessDay();
    let product = await this.productRepo.findOne({ where: { effiId: raw.dropiId, country } });
    let pendingYesterday: { id: string; salesYesterday: number } | null = null;

    if (!product) {
      product = this.productRepo.create({
        effiId: raw.dropiId, name: raw.name, imageUrl: raw.imageUrl,
        provider: raw.provider, category: raw.category, subcategory: raw.subcategory,
        price: raw.price, cost: raw.cost, stock: raw.stock,
        totalSalesAccum: 0, salesBaseline: 0, salesBaselineDate: today,
        salesToday: 0, salesYesterday: 0, isActive: true, country,
        platform: 'dropi',
      });
      await this.productRepo.save(product);
    } else {
      // Sales computed from stock decrease (Dropi has no salesAccum field)
      const stockDelta    = Math.max(0, product.stock - raw.stock);
      const newAccum      = product.totalSalesAccum + stockDelta;
      const isNewDay      = product.salesBaselineDate !== today;

      if (isNewDay) {
        const lastDate  = new Date(product.salesBaselineDate + 'T12:00:00');
        const todayDate = new Date(today + 'T12:00:00');
        const dayGap    = Math.round((todayDate.getTime() - lastDate.getTime()) / 86_400_000);
        if (dayGap === 1) {
          pendingYesterday = { id: product.id, salesYesterday: Math.max(0, product.totalSalesAccum - product.salesBaseline) };
        }
        product.salesBaseline     = newAccum;
        product.salesBaselineDate = today;
      }

      product.name           = raw.name;
      product.imageUrl       = raw.imageUrl;
      product.provider       = raw.provider;
      product.price          = raw.price;
      product.cost           = raw.cost;
      product.stock          = raw.stock;
      product.totalSalesAccum = newAccum;
      product.salesToday     = Math.max(0, newAccum - product.salesBaseline);
      product.isActive       = true;
      await this.productRepo.save(product);
    }

    await this.snapshotRepo.save(
      this.snapshotRepo.create({ productId: product.id, salesAccum: product.totalSalesAccum, price: raw.price, stock: raw.stock }),
    );

    return pendingYesterday;
  }

}
