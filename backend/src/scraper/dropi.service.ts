import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { chromium, Browser } from 'playwright';
import { Product } from '../products/product.entity';
import { Snapshot } from '../snapshots/snapshot.entity';

const CDN = 'https://d3sk39qh2f4j46.cloudfront.net/';
const PAGE_SIZE = 100;
const CYCLE_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

function businessDay(): string {
  const now = new Date();
  const adj = new Date(now);
  if (now.getUTCHours() < 7) adj.setUTCDate(adj.getUTCDate() - 1);
  return adj.toISOString().slice(0, 10);
}

export const DROPI_COUNTRIES = [
  { code: 'CR', loginUrl: 'https://app.dropi.cr/auth/login', apiBase: 'https://api.dropi.cr', countryKey: 'COSTARICA' },
  // CO desactivado — credenciales no válidas para esa plataforma
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
export class DropisService implements OnModuleDestroy {
  private readonly logger = new Logger(DropisService.name);
  private running = false;
  private lastStats = { total: 0, durationMs: 0, finishedAt: null as Date | null };

  constructor(
    private config: ConfigService,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Snapshot) private snapshotRepo: Repository<Snapshot>,
  ) {}

  async onModuleDestroy() { this.running = false; }

  getStats() { return { running: this.running, ...this.lastStats }; }

  start() {
    if (this.running) return;
    this.running = true;
    this.logger.log('Dropi loop iniciado');
    this.loop();
  }

  private async loop() {
    while (this.running) {
      const t = Date.now();
      let total = 0;
      const email = this.config.get<string>('DROPI_EMAIL')!;
      const password = this.config.get<string>('DROPI_PASSWORD')!;
      if (!email || !password) {
        this.logger.error('DROPI_EMAIL / DROPI_PASSWORD no configurados — omitiendo ciclo');
        await new Promise(r => setTimeout(r, CYCLE_INTERVAL_MS));
        continue;
      }
      for (const def of DROPI_COUNTRIES) {
        try {
          const { saved } = await this.scrapeCountry(def, email, password);
          total += saved;
        } catch (err) {
          this.logger.error(`[Dropi:${def.code}] Error en ciclo`, err);
        }
      }
      this.lastStats = { total, durationMs: Date.now() - t, finishedAt: new Date() };
      this.logger.log(`Dropi ciclo completo — ${total} productos en ${Math.round((Date.now() - t) / 1000)}s. Próximo en 2h.`);
      await new Promise(r => setTimeout(r, CYCLE_INTERVAL_MS));
    }
  }

  async scrapeCountry(def: typeof DROPI_COUNTRIES[0], emailOverride?: string, passwordOverride?: string): Promise<{ saved: number }> {
    const email    = emailOverride    ?? this.config.get<string>('DROPI_EMAIL')!;
    const password = passwordOverride ?? this.config.get<string>('DROPI_PASSWORD')!;
    const { code, loginUrl, apiBase, countryKey } = def;

    const token = await this.login(loginUrl, email, password, code);
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

  private async login(loginUrl: string, email: string, password: string, code: string): Promise<string | null> {
    let browser: Browser | null = null;
    let token: string | null = null;
    try {
      browser = await chromium.launch({ headless: true, executablePath: this.chromiumPath() });
      const page = await browser.newPage();

      // Capture token from any auth-related response
      page.on('response', async resp => {
        if (token) return;
        const url = resp.url();
        if (!url.includes('login') && !url.includes('auth') && !url.includes('token')) return;
        try {
          const ct = resp.headers()['content-type'] ?? '';
          if (!ct.includes('json')) return;
          const d = await resp.json();
          const t = d.token ?? d.access_token ?? d.accessToken ?? d.jwt ?? d.data?.token ?? d.data?.access_token;
          if (t) { token = t; this.logger.log(`[Dropi:${code}] Token capturado desde ${url}`); }
        } catch {}
      });

      await page.route('**', route => {
        const rt = route.request().resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(rt)) route.abort().catch(() => {});
        else route.continue().catch(() => {});
      });

      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Try multiple selector patterns for different Dropi versions
      const emailSel = ['#email', 'input[type="email"]', 'input[name="email"]', 'input[placeholder*="email" i]'];
      const passSel  = ['#password', 'input[type="password"]', 'input[name="password"]'];
      const btnSel   = ['button.primary', 'button[type="submit"]', 'button:has-text("Iniciar")', 'button:has-text("Ingresar")', 'button:has-text("Login")'];

      let filled = false;
      for (const sel of emailSel) {
        try { await page.fill(sel, email, { timeout: 3000 }); filled = true; break; } catch {}
      }
      if (!filled) { this.logger.error(`[Dropi:${code}] No se encontró campo email`); return null; }
      for (const sel of passSel) {
        try { await page.fill(sel, password, { timeout: 3000 }); break; } catch {}
      }
      for (const sel of btnSel) {
        try { await page.click(sel, { timeout: 3000 }); break; } catch {}
      }
      // Wait up to 6s for token — if page closes early but we have token, that's OK
      await page.waitForTimeout(6000).catch(() => {});

      // Fallback: read token from localStorage if page still alive
      if (!token) {
        try {
          const ls = await page.evaluate(() => {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i) ?? '';
              const val = localStorage.getItem(key) ?? '';
              if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) return val;
              try { const j = JSON.parse(val); if (j?.token) return j.token; if (j?.access_token) return j.access_token; } catch {}
            }
            return null;
          });
          if (ls) { token = ls; this.logger.log(`[Dropi:${code}] Token desde localStorage`); }
        } catch {}
      }

      if (!token) this.logger.warn(`[Dropi:${code}] Sin token — verifica credenciales`);
      return token;
    } catch (err: any) {
      if (token) {
        this.logger.warn(`[Dropi:${code}] Error post-login ignorado (token ya obtenido): ${err?.message}`);
        return token;
      }
      this.logger.error(`[Dropi:${code}] Login error`, err);
      return null;
    } finally {
      await browser?.close().catch(() => {});
    }
  }

  private chromiumPath(): string | undefined {
    const { existsSync } = require('fs');
    for (const p of [
      process.env.CHROMIUM_PATH,
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ].filter(Boolean) as string[]) {
      if (existsSync(p)) return p;
    }
  }

  private async fetchAll(apiBase: string, token: string, countryKey: string, code: string): Promise<DropiRaw[]> {
    const all: DropiRaw[] = [];
    let start = 0;

    // Try different country key formats
    const countryVariants = [countryKey, countryKey.toLowerCase(), countryKey.toUpperCase(), 'CR', 'DO', 'RD'];
    let workingKey = countryKey;

    while (true) {
      const key = start === 0 ? workingKey : workingKey;
      const rawResp = await fetch(`${apiBase}/api/products/v4/index`, {
        method: 'POST',
        headers: {
          'x-authorization': `Bearer ${token}`,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageSize: PAGE_SIZE, startData: start,
          privated_product: false, userVerified: false, favorite: false,
          with_collection: true, get_stock: true, no_count: true,
          search_type: 'simple', country: key,
        }),
      });
      const resp = await rawResp.json() as any;

      // On first page and 403, try to find working countryKey
      if (start === 0 && rawResp.status === 403) {
        this.logger.log(`[Dropi:${code}] 403 con key="${key}" — probando variantes`);
        for (const variant of countryVariants) {
          if (variant === key) continue;
          const r2 = await fetch(`${apiBase}/api/products/v4/index`, {
            method: 'POST',
            headers: { 'x-authorization': `Bearer ${token}`, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageSize: 1, startData: 0, get_stock: true, country: variant }),
          });
          const d2 = await r2.json() as any;
          this.logger.log(`[Dropi:${code}] variant="${variant}" → HTTP ${r2.status} | objects: ${d2.objects?.length ?? 'null'} | msg: ${d2.message ?? ''}`);
          if (r2.status === 200 && d2.objects) { workingKey = variant; break; }
        }
      }

      if (start === 0) {
        this.logger.log(`[Dropi:${code}] HTTP ${rawResp.status} | RESP_KEYS: ${Object.keys(resp).join(', ')} | objects: ${resp.objects?.length ?? 'undefined'} | msg: ${resp.message ?? ''} | status: ${resp.status}`);
      }

      const items: any[] = resp.objects ?? [];
      if (!items.length) break;

      if (start === 0 && items.length > 0) {
        this.logger.log(`[Dropi:${code}] SAMPLE_ITEM_KEYS: ${Object.keys(items[0]).join(', ')}`);
        this.logger.log(`[Dropi:${code}] SAMPLE_ITEM: ${JSON.stringify(items[0]).slice(0, 500)}`);
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
