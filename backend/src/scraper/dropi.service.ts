import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { chromium, Browser } from 'playwright';
import { Product } from '../products/product.entity';
import { Snapshot } from '../snapshots/snapshot.entity';

const PAGE_SIZE = 100;
const DROPI_CDNS = [
  'https://d3sk39qh2f4j46.cloudfront.net/',  // CR
  'https://d2ob47cxeawi8a.cloudfront.net/',  // GT
  'https://d39ru7awumhhs2.cloudfront.net/',  // EC
];

function businessDay(): string {
  const now = new Date();
  const adj = new Date(now);
  if (now.getUTCHours() < 7) adj.setUTCDate(adj.getUTCDate() - 1);
  return adj.toISOString().slice(0, 10);
}

export const DROPI_COUNTRIES = [
  { code: 'CR', loginUrl: 'https://app.dropi.cr/auth/login', apiBase: 'https://api.dropi.cr', countryKey: 'COSTARICA', emailEnv: 'DROPI_CR_EMAIL', passwordEnv: 'DROPI_CR_PASSWORD' },
  { code: 'GT', loginUrl: 'https://app.dropi.gt/auth/login', apiBase: 'https://api.dropi.gt', countryKey: 'GUATEMALA',  emailEnv: 'DROPI_GT_EMAIL', passwordEnv: 'DROPI_GT_PASSWORD' },
  { code: 'EC', loginUrl: 'https://app.dropi.ec/auth/login', apiBase: 'https://api.dropi.ec', countryKey: 'ECUADOR',    emailEnv: 'DROPI_EC_EMAIL', passwordEnv: 'DROPI_EC_PASSWORD' },
  { code: 'CL', loginUrl: 'https://app.dropi.cl/auth/login', apiBase: 'https://api.dropi.cl', countryKey: 'CHILE',      emailEnv: 'DROPI_CL_EMAIL', passwordEnv: 'DROPI_CL_PASSWORD' },
  { code: 'CO', loginUrl: 'https://app.dropi.co/auth/login', apiBase: 'https://api.dropi.co', countryKey: 'COLOMBIA',   emailEnv: 'DROPI_CO_EMAIL', passwordEnv: 'DROPI_CO_PASSWORD' },
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

  async runAll(): Promise<void> {
    const t = Date.now();
    let total = 0;
    for (const def of DROPI_COUNTRIES) {
      const email    = this.config.get<string>(def.emailEnv);
      const password = this.config.get<string>(def.passwordEnv);
      if (!email || !password) {
        this.logger.warn(`[Dropi:${def.code}] Sin credenciales (${def.emailEnv}) — omitiendo`);
        continue;
      }
      try {
        const { saved } = await this.scrapeCountry(def, email, password);
        total += saved;
      } catch (err) {
        this.logger.error(`[Dropi:${def.code}] Error en ciclo`, err);
      }
    }
    this.lastStats = { total, durationMs: Date.now() - t, finishedAt: new Date() };
    this.logger.log(`Dropi ciclo completo — ${total} productos en ${Math.round((Date.now() - t) / 1000)}s`);
  }

  async scrapeCountry(def: typeof DROPI_COUNTRIES[0], emailOverride?: string, passwordOverride?: string): Promise<{ saved: number }> {
    const email    = emailOverride    ?? this.config.get<string>(def.emailEnv)!;
    const password = passwordOverride ?? this.config.get<string>(def.passwordEnv)!;
    const { code, loginUrl, apiBase, countryKey } = def;

    const loginResult = await this.loginKeepBrowser(loginUrl, email, password, code);
    if (!loginResult) { this.logger.error(`[Dropi:${code}] Login fallido`); return { saved: 0 }; }
    const { token, browser, page } = loginResult;
    this.logger.log(`[Dropi:${code}] Token OK — fetching products via browser session...`);

    let products: DropiRaw[] = [];
    try {
      products = await this.fetchAllViaBrowser(page, apiBase, token, countryKey, code);
    } finally {
      await browser.close().catch(() => {});
    }
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

  private async loginKeepBrowser(loginUrl: string, email: string, password: string, code: string): Promise<{ browser: Browser; page: any; token: string } | null> {
    let browser: Browser | null = null;
    let token: string | null = null;
    try {
      browser = await chromium.launch({ headless: true, executablePath: this.chromiumPath() });
      const page = await browser.newPage();

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

      const emailSel = ['#email', 'input[type="email"]', 'input[name="email"]', 'input[placeholder*="email" i]'];
      const passSel  = ['#password', 'input[type="password"]', 'input[name="password"]'];
      const btnSel   = ['button.primary', 'button[type="submit"]', 'button:has-text("Iniciar")', 'button:has-text("Ingresar")', 'button:has-text("Login")'];

      let filled = false;
      for (const sel of emailSel) {
        try { await page.fill(sel, email, { timeout: 3000 }); filled = true; break; } catch {}
      }
      if (!filled) { this.logger.error(`[Dropi:${code}] No se encontró campo email`); await browser.close().catch(() => {}); return null; }
      for (const sel of passSel) {
        try { await page.fill(sel, password, { timeout: 3000 }); break; } catch {}
      }
      for (const sel of btnSel) {
        try { await page.click(sel, { timeout: 3000 }); break; } catch {}
      }

      // Wait for SPA to navigate away from login page (dashboard/home)
      try {
        await page.waitForURL((url: URL) => !url.toString().includes('/auth') && !url.toString().includes('/login'), { timeout: 15000 });
        this.logger.log(`[Dropi:${code}] Post-login URL: ${page.url()}`);
      } catch {
        // If waitForURL times out, wait a bit and check if we have token
        await page.waitForTimeout(5000).catch(() => {});
      }

      // Fallback: localStorage
      if (!token) {
        try {
          const ls = await page.evaluate(() => {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i) ?? '';
              const val = localStorage.getItem(key) ?? '';
              if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) return val;
              try { const j = JSON.parse(val); if (j?.token) return j.token; if (j?.access_token) return j.access_token; } catch {}
            }
            // Also check sessionStorage
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i) ?? '';
              const val = sessionStorage.getItem(key) ?? '';
              if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) return val;
              try { const j = JSON.parse(val); if (j?.token) return j.token; if (j?.access_token) return j.access_token; } catch {}
            }
            return null;
          });
          if (ls) { token = ls; this.logger.log(`[Dropi:${code}] Token desde storage`); }
        } catch {}
      }

      if (!token) {
        this.logger.warn(`[Dropi:${code}] Sin token`);
        await browser.close().catch(() => {});
        return null;
      }
      // Page is stable at dashboard — return it for evaluate() calls
      return { browser, page, token };
    } catch (err: any) {
      this.logger.error(`[Dropi:${code}] Login error: ${err?.message}`);
      await browser?.close().catch(() => {});
      return null;
    }
  }

  private async detectCdn(firstUrlS3: string): Promise<string> {
    for (const cdn of DROPI_CDNS) {
      try {
        const r = await fetch(encodeURI(`${cdn}${firstUrlS3}`), { method: 'HEAD' });
        if (r.ok) { this.logger.log(`CDN detected: ${cdn}`); return cdn; }
      } catch {}
    }
    this.logger.warn(`No CDN returned 200 for ${firstUrlS3}, defaulting to first`);
    return DROPI_CDNS[0];
  }

  private async fetchAllViaBrowser(page: any, apiBase: string, token: string, countryKey: string, code: string): Promise<DropiRaw[]> {
    const all: DropiRaw[] = [];
    const seenIds = new Set<number>();
    const seenUserIds = new Set<number>();
    let start = 0;
    let emptyConsecutive = 0;
    let cdn: string | null = null;

    while (true) {
      const result = await page.evaluate(async ({ apiBase, token, countryKey, start, pageSize }: any) => {
        try {
          const r = await fetch(`${apiBase}/api/products/v4/index`, {
            method: 'POST',
            headers: {
              'x-authorization': `Bearer ${token}`,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pageSize, startData: start,
              privated_product: false, userVerified: false, favorite: false,
              with_collection: true, get_stock: true, no_count: true,
              search_type: 'simple', country: countryKey,
            }),
          });
          const d = await r.json();
          return { status: r.status, data: d };
        } catch (e: any) { return { status: 0, error: String(e) }; }
      }, { apiBase, token, countryKey, start, pageSize: PAGE_SIZE });

      const items: any[] = result.data?.objects ?? [];
      this.logger.log(`[Dropi:${code}] start=${start} → HTTP ${result.status} | items: ${items.length} | total acumulado: ${all.length}`);
      if (start === 0 && items.length > 0) {
        this.logger.log(`[Dropi:${code}] RAW_USER_FIELDS: ${JSON.stringify(items[0].user)}`);
        if (!cdn && items[0].gallery?.[0]?.urlS3) {
          cdn = await this.detectCdn(items[0].gallery[0].urlS3);
          this.logger.log(`[Dropi:${code}] Using CDN: ${cdn}`);
        }
        if (!cdn) cdn = DROPI_CDNS[0];
      }

      if (result.status !== 200) break;

      let newThisPage = 0;
      for (const item of items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          const activeCdn = cdn ?? DROPI_CDNS[0];
          const imageUrl = item.gallery?.[0]?.urlS3 ? `${activeCdn}${item.gallery[0].urlS3}` : '';
          const rawStock = item.warehouse_product?.[0]?.stock ?? 0;
          if (item.user?.id && !seenUserIds.has(item.user.id)) {
            seenUserIds.add(item.user.id);
            this.logger.log(`[Dropi:${code}] USER id=${item.user.id} name="${item.user.name}" store_name="${item.user.store_name ?? ''}"`);
          }
          all.push({
            dropiId: `dropi_${item.id}`,
            name: item.name ?? '',
            imageUrl,
            provider: item.user?.store_name || item.user?.name || '',
            category: item.categories?.[0]?.name ?? '',
            subcategory: item.categories?.[1]?.name ?? '',
            price: item.suggested_price ?? 0,
            cost: item.sale_price ?? 0,
            stock: rawStock > 100_000_000 ? 0 : rawStock,
          });
          newThisPage++;
        }
      }

      // Break only when API returns truly empty — not on partial pages
      if (items.length === 0 || newThisPage === 0) {
        emptyConsecutive++;
        if (emptyConsecutive >= 2) break;
      } else {
        emptyConsecutive = 0;
      }

      start += PAGE_SIZE;
    }

    if (all.length > 0) {
      this.logger.log(`[Dropi:${code}] SAMPLE: ${JSON.stringify({ id: all[0].dropiId, name: all[0].name, stock: all[0].stock })}`);
    }
    return all;
  }

  async scrapeOnce(): Promise<{ saved: number }> {
    const email    = this.config.get<string>('DROPI_EMAIL')!;
    const password = this.config.get<string>('DROPI_PASSWORD')!;
    const def = DROPI_COUNTRIES[0];
    return this.scrapeCountry(def, email, password);
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
