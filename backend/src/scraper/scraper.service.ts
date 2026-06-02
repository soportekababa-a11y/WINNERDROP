import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { Product } from '../products/product.entity';
import { Snapshot } from '../snapshots/snapshot.entity';
import { ProductsService } from '../products/products.service';

const EFFI_LOGIN_URL = 'https://effi.com.co/ingreso';
const EFFI_CATALOG_URL = 'https://effi.com.co/app/articulo_dropshipping';
const SCRAPE_INTERVAL_MS = 30 * 60 * 1000;
const PRODUCTS_PER_PAGE = 40;

const COUNTRY_TZ: Record<string, string> = {
  RD: 'America/Santo_Domingo',
  GT: 'America/Guatemala',
  EC: 'America/Guayaquil',
  CR: 'America/Costa_Rica',
  CO: 'America/Bogota',
};

function todayForCountry(country: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: COUNTRY_TZ[country] ?? 'America/Santo_Domingo' });
}

const COUNTRIES: Array<{ code: string; storeName: string | null }> = [
  { code: 'RD', storeName: null },           // default store after login
  { code: 'GT', storeName: 'Guatemala 1' },  // must select this store
  { code: 'EC', storeName: 'Ecuador' },      // matches ECUADOR 1 etc.
  { code: 'CR', storeName: 'Costa Rica' },   // 54832 - COSTA RICA
  { code: 'CO', storeName: 'Colombia' },     // 54865 - COLOMBIA
];

@Injectable()
export class ScraperService implements OnModuleDestroy {
  private readonly logger = new Logger(ScraperService.name);
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private isRunning = false;
  private intervalHandle: NodeJS.Timeout | null = null;
  private lastScrapeStats = { total: 0, pages: 0, durationMs: 0, finishedAt: null as Date | null };
  private progress = { currentPage: 0, totalPages: 0, accumulated: 0, country: '' };
  private lastCleanupDate = '';
  private isCycleRunning = false;

  constructor(
    private config: ConfigService,
    private productsService: ProductsService,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Snapshot) private snapshotRepo: Repository<Snapshot>,
  ) {}

  async onModuleDestroy() {
    await this.stop();
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      ...this.lastScrapeStats,
      progress: this.isRunning ? this.progress : null,
    };
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.log('Scraper iniciado');
    this.startWithRetry();
  }

  private async startWithRetry() {
    const RETRY_DELAY_MS = 60 * 1000;

    // Launch browser — retry until success
    while (true) {
      try {
        await this.launchBrowser();
        break;
      } catch (err) {
        this.logger.error(`No se pudo lanzar el browser, reintentando en ${RETRY_DELAY_MS / 1000}s...`, err);
        await this.browser?.close().catch(() => {});
        this.browser = null;
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }

    // Login each country independently — failed countries are skipped, not fatal
    await this.loginAllCountries();

    // First scrape cycle — only run if at least one country logged in
    if (this.contexts.size > 0) {
      await this.runCycle().catch(err => this.logger.error('Error en primer ciclo', err));
    }

    this.intervalHandle = setInterval(async () => {
      await this.runCycle();
    }, SCRAPE_INTERVAL_MS);
  }

  async stop() {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    this.isRunning = false;
    for (const ctx of this.contexts.values()) await ctx.close().catch(() => {});
    this.contexts.clear();
    await this.browser?.close().catch(() => {});
    this.logger.log('Scraper detenido');
  }

  private jitter(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private userAgent() {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  private async launchBrowser() {
    const { existsSync } = await import('fs');
    const candidates = [
      process.env.CHROMIUM_PATH,
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/snap/bin/chromium',
    ].filter(Boolean) as string[];

    let executablePath: string | undefined;
    for (const p of candidates) {
      if (existsSync(p)) { executablePath = p; break; }
    }

    this.logger.log(`Chromium: ${executablePath ?? 'bundled'}`);
    this.browser = await chromium.launch({
      headless: true,
      executablePath,
      args: ['--disable-blink-features=AutomationControlled'],
    });
  }

  private async loginAllCountries() {
    const email = this.config.get<string>('EFFI_EMAIL');
    const password = this.config.get<string>('EFFI_PASSWORD');

    for (const { code, storeName } of COUNTRIES) {
      await this.loginCountry(code, storeName, email!, password!);
      await new Promise(r => setTimeout(r, 3000));
    }

    this.logger.log(`Login completo: ${this.contexts.size}/${COUNTRIES.length} países activos`);
  }

  private async loginCountry(code: string, storeName: string | null, email: string, password: string) {
    const existing = this.contexts.get(code);
    if (existing) await existing.close().catch(() => {});
    this.contexts.delete(code);

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let context: import('playwright').BrowserContext | null = null;
      try {
        this.logger.log(`Iniciando sesión para país: ${code}${attempt > 1 ? ` (intento ${attempt})` : ''}`);
        const viewports = [
          { width: 1920, height: 1080 },
          { width: 1440, height: 900 },
          { width: 1366, height: 768 },
          { width: 1536, height: 864 },
        ];
        const vp = viewports[Math.floor(Math.random() * viewports.length)];
        context = await this.browser!.newContext({
          userAgent: this.userAgent(),
          viewport: vp,
          locale: 'es-419',
          timezoneId: 'America/Santo_Domingo',
        });
        await this.loginContext(context, email, password, storeName);
        this.contexts.set(code, context);
        return;
      } catch (err) {
        await context?.close().catch(() => {});
        if (attempt < MAX_ATTEMPTS) {
          this.logger.warn(`Login ${code} intento ${attempt} fallido, reintentando en 5s...`);
          await new Promise(r => setTimeout(r, 5000));
        } else {
          this.logger.error(`Login fallido para ${code} tras ${MAX_ATTEMPTS} intentos — omitido`, err);
        }
      }
    }
  }

  async login() {
    // Keep for backward compat — re-login all
    await this.loginAllCountries();
  }

  private async loginContext(context: BrowserContext, email: string, password: string, storeName: string | null) {
    const page = await context.newPage();
    try {
      await page.goto(EFFI_LOGIN_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(this.jitter(600, 1200));

      const emailInput = page.locator('input[type="email"], input[placeholder*="Email"], input[placeholder*="email"]');
      await emailInput.click();
      await page.waitForTimeout(this.jitter(200, 500));
      await emailInput.type(email, { delay: this.jitter(40, 90) });
      await page.waitForTimeout(this.jitter(300, 700));

      const passInput = page.locator('input[type="password"]');
      await passInput.click();
      await page.waitForTimeout(this.jitter(200, 400));
      await passInput.type(password, { delay: this.jitter(40, 90) });
      await page.waitForTimeout(this.jitter(400, 900));

      await page.locator('button[type="submit"], button:has-text("Ingresar")').first().click();

      // Wait for company selector page at /ingreso/validar_usuario
      await page.waitForURL('**/ingreso/validar_usuario', { timeout: 20000 });

      // Effi uses jQuery Chosen — native <select> is hidden, must click Chosen widget
      const chosenContainer = page.locator('.chosen-container').first();
      await chosenContainer.waitFor({ state: 'visible', timeout: 10000 });
      await chosenContainer.click();

      // Wait for Chosen dropdown results to appear
      const resultItems = page.locator('.chosen-results li.active-result');
      await resultItems.first().waitFor({ state: 'visible', timeout: 5000 });

      const optionTexts = await resultItems.allTextContents();
      this.logger.log(`Empresas disponibles: ${JSON.stringify(optionTexts)}`);

      if (storeName) {
        // Case-insensitive match (Effi stores names in UPPERCASE)
        const match = resultItems.filter({ hasText: new RegExp(storeName, 'i') });
        const count = await match.count();
        if (count > 0) {
          const text = await match.first().textContent();
          await match.first().click();
          this.logger.log(`Empresa seleccionada: "${text?.trim()}"`);
        } else {
          this.logger.warn(`No se encontró empresa "${storeName}". Opciones: ${JSON.stringify(optionTexts)}`);
          await resultItems.first().click();
        }
      } else {
        // RD: first option that isn't the placeholder, Guatemala, or Costa Rica
        const rdItems = resultItems
          .filter({ hasNotText: /guatemala/i })
          .filter({ hasNotText: /costa rica/i })
          .filter({ hasNotText: /seleccione/i });
        const rdCount = await rdItems.count();
        if (rdCount > 0) {
          const text = await rdItems.first().textContent();
          await rdItems.first().click();
          this.logger.log(`Empresa RD seleccionada: "${text?.trim()}"`);
        } else {
          // Fallback: second item (skip placeholder)
          const text = await resultItems.nth(1).textContent().catch(() => '?');
          await resultItems.nth(1).click();
          this.logger.log(`Empresa RD seleccionada (fallback): "${text?.trim()}"`);
        }
      }

      // Click Ingresar on the company selector form
      await page.locator('button:has-text("Ingresar")').click();

      // Click Ingresar on the company selector form was already clicked above
      // Wait for navigation away from /ingreso paths
      await page.waitForURL(url => !url.href.includes('/ingreso'), { timeout: 20000 });

      // Navigate to catalog — keeps Chrome renderer active and verifies session works
      await page.goto(EFFI_CATALOG_URL, { waitUntil: 'networkidle', timeout: 30000 });

      if (page.url().includes('/ingreso')) {
        throw new Error(`Login fallido — redirigido a ${page.url()}`);
      }

      this.logger.log(`Sesión activa${storeName ? ` [${storeName}]` : ' [RD]'}`);
    } finally {
      await page.close();
    }
  }

  private isBrowserDead(): boolean {
    return !this.browser || !this.browser.isConnected();
  }

  private async ensureBrowserAlive(): Promise<boolean> {
    if (!this.isBrowserDead()) return true;

    this.logger.warn('Browser muerto — reiniciando Chromium y re-logineando...');
    await this.browser?.close().catch(() => {});
    this.browser = null;
    for (const ctx of this.contexts.values()) await ctx.close().catch(() => {});
    this.contexts.clear();

    try {
      await this.launchBrowser();
      await this.loginAllCountries();
      return this.contexts.size > 0;
    } catch (err) {
      this.logger.error('No se pudo reiniciar el browser', err);
      return false;
    }
  }

  private async runCycle() {
    if (this.isCycleRunning) {
      this.logger.warn('Ciclo anterior aún en ejecución — omitiendo');
      return;
    }
    this.isCycleRunning = true;

    const start = Date.now();
    let totalProducts = 0;
    let totalPages = 0;
    const email = this.config.get<string>('EFFI_EMAIL')!;
    const password = this.config.get<string>('EFFI_PASSWORD')!;

    try {
      if (!await this.ensureBrowserAlive()) {
        this.logger.error('Browser no disponible — ciclo omitido');
        return;
      }

      for (const { code, storeName } of COUNTRIES) {
        // Ensure active session for this country
        if (!this.contexts.has(code)) {
          this.logger.warn(`[${code}] Sin sesión — intentando login...`);
          await this.loginCountry(code, storeName, email, password);
          if (!this.contexts.has(code)) {
            this.logger.error(`[${code}] Login fallido — se omite, se reintenta en próximo ciclo`);
            continue;
          }
        }

        const context = this.contexts.get(code)!;
        this.logger.log(`[${code}] Iniciando scrape`);
        let page: import('playwright').Page | null = null;

        try {
          page = await context.newPage();
          const { products, pages } = await this.scrapeAllPages(page, code);
          this.logger.log(`[${code}] ${products.length} productos en ${pages} páginas`);

          let saved = 0;
          for (const raw of products) {
            try {
              await this.upsertProductAndSnapshot(raw, code);
              saved++;
            } catch (dbErr) {
              this.logger.error(`[${code}] Error guardando ${raw.effiId}`, dbErr);
            }
          }

          if (products.length > 100) {
            const scrapedIds = products.map(p => p.effiId);
            await this.productRepo
              .createQueryBuilder()
              .update()
              .set({ isActive: false })
              .where('"effiId" NOT IN (:...ids) AND "isActive" = true AND country = :country', { ids: scrapedIds, country: code })
              .execute()
              .catch(err => this.logger.error(`[${code}] Error desactivando productos viejos`, err));
          }

          this.logger.log(`[${code}] Guardados: ${saved}/${products.length}`);
          totalProducts += saved;
          totalPages += pages;

        } catch (err) {
          const errMsg = String(err);
          const browserDied = this.isBrowserDead()
            || errMsg.includes('has been closed')
            || errMsg.includes('Target closed')
            || errMsg.includes('browser has been closed');

          if (browserDied) {
            this.logger.error(`[${code}] Browser muerto durante ciclo — reiniciando en próximo ciclo`);
            await this.browser?.close().catch(() => {});
            this.browser = null;
            for (const ctx of this.contexts.values()) await ctx.close().catch(() => {});
            this.contexts.clear();
            break; // stop processing other countries, next cycle will re-launch
          }

          // Non-fatal country error: close stale context, re-login, continue to next country
          this.logger.error(`[${code}] Error — se omite y se reintenta próximo ciclo`, err);
          const staleCtx = this.contexts.get(code);
          if (staleCtx) { await staleCtx.close().catch(() => {}); this.contexts.delete(code); }
          await this.loginCountry(code, storeName, email, password);

        } finally {
          await page?.close().catch(() => {});
        }
      }

      await this.cleanupOldSnapshots();
      await this.productsService.refreshDailyCache().catch(err =>
        this.logger.error('Error refrescando cache diario', err)
      );

      this.lastScrapeStats = {
        total: totalProducts,
        pages: totalPages,
        durationMs: Date.now() - start,
        finishedAt: new Date(),
      };

      this.logger.log(`Ciclo completo en ${Math.round((Date.now() - start) / 1000)}s — ${totalProducts} productos`);

    } finally {
      this.isCycleRunning = false;
    }
  }

  private async scrapeAllPages(page: Page, country: string): Promise<{ products: RawProduct[]; pages: number }> {
    const all: RawProduct[] = [];
    let pageNum = 1;

    await page.goto(EFFI_CATALOG_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const totalText = await page.locator('text=/\\d+ Artículos/').textContent().catch(() => '');
    const totalMatch = (totalText ?? '').match(/([\d,]+)\s+Artículos/);
    const totalProducts = totalMatch ? parseInt(totalMatch[1].replace(',', '')) : 3000;
    const totalPagesCount = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);
    this.logger.log(`[${country}] Total productos: ${totalProducts} | Total páginas: ${totalPagesCount}`);

    this.progress = { currentPage: 1, totalPages: totalPagesCount, accumulated: 0, country };

    while (pageNum <= totalPagesCount) {
      const url = pageNum === 1 ? EFFI_CATALOG_URL : `${EFFI_CATALOG_URL}?page=${pageNum}`;

      if (pageNum > 1) {
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
      }

      const cards = await page.locator('.product-card').count();
      if (cards === 0) break;

      const pageProducts = await this.extractPageProducts(page);
      all.push(...pageProducts);

      this.progress = { currentPage: pageNum, totalPages: totalPagesCount, accumulated: all.length, country };

      if (pageNum % 10 === 0) {
        this.logger.log(`  [${country}] Página ${pageNum}/${totalPagesCount} — acumulado: ${all.length}`);
      }

      pageNum++;
    }

    return { products: all, pages: pageNum - 1 };
  }

  private async extractPageProducts(page: Page): Promise<RawProduct[]> {
    return page.evaluate(() => {
      const cards = document.querySelectorAll('.product-card');
      const results: any[] = [];

      cards.forEach(card => {
        try {
          const verDetalles = card.querySelector('.ver-detalles');
          const name = verDetalles?.getAttribute('data-descripcion')?.trim() ?? '';
          if (!name) return;

          const effiId = verDetalles?.getAttribute('data-codigo') ?? '';
          const imageUrl = verDetalles?.getAttribute('data-url_foto')
            ?? (card.querySelector('.img-box img') as HTMLImageElement)?.src ?? '';

          const labels = Array.from(card.querySelectorAll('.product-stats .label'));
          let stock = 0, salesAccum = 0;
          labels.forEach(label => {
            const text = label.textContent ?? '';
            const stockM = text.match(/Stock:\s*([\d,]+)/);
            const salesM = text.match(/Ventas:\s*([\d,]+)/);
            if (stockM) stock      = parseInt(stockM[1].replace(/,/g, ''));
            if (salesM) salesAccum = parseInt(salesM[1].replace(/,/g, ''));
          });

          const priceText = card.querySelector('.price-block')?.textContent ?? '';
          const costoM    = priceText.match(/Costo[:\s]+(?:RD\$|Q)?\s*([\d,.]+)/i);
          const sugeridoM = priceText.match(/Sugerido[:\s]+(?:RD\$|Q)?\s*([\d,.]+)/i);
          const cost  = costoM    ? parseFloat(costoM[1].replace(/,/g, ''))    : 0;
          const price = sugeridoM ? parseFloat(sugeridoM[1].replace(/,/g, '')) : cost;

          const metaLinks = Array.from(card.querySelectorAll('.product-meta a'));
          const provider    = metaLinks[0]?.textContent?.trim() ?? '';
          const category    = metaLinks[1]?.textContent?.trim() ?? '';
          const subcategory = metaLinks[2]?.textContent?.trim() ?? '';

          results.push({ effiId, name, imageUrl, stock, salesAccum, cost, price, provider, category, subcategory });
        } catch(e) {}
      });

      return results;
    });
  }

  private async upsertProductAndSnapshot(raw: RawProduct, country: string) {
    let product = await this.productRepo.findOne({ where: { effiId: raw.effiId, country } });

    const today = todayForCountry(country);

    if (!product) {
      product = this.productRepo.create({
        effiId: raw.effiId,
        name: raw.name,
        imageUrl: raw.imageUrl,
        provider: raw.provider,
        category: raw.category,
        subcategory: raw.subcategory,
        price: raw.price,
        cost: raw.cost,
        stock: raw.stock,
        totalSalesAccum: raw.salesAccum,
        salesBaseline: raw.salesAccum,
        salesBaselineDate: today,
        salesToday: 0,
        salesYesterday: 0,
        isActive: true,
        country,
      });
      await this.productRepo.save(product);
    } else {
      const isNewDay = product.salesBaselineDate !== today;

      if (isNewDay) {
        const lastDate = new Date(product.salesBaselineDate + 'T12:00:00');
        const todayDate = new Date(today + 'T12:00:00');
        const dayGap = Math.round((todayDate.getTime() - lastDate.getTime()) / 86_400_000);
        // Only trust salesYesterday when gap == 1 day; multi-day gaps give inflated values
        if (dayGap === 1) {
          product.salesYesterday = Math.max(0, raw.salesAccum - product.salesBaseline);
        } else {
          product.salesYesterday = 0;
        }
        product.salesBaseline = raw.salesAccum;
        product.salesBaselineDate = today;
      }

      product.name = raw.name;
      product.imageUrl = raw.imageUrl;
      product.provider = raw.provider;
      product.price = raw.price;
      product.cost = raw.cost;
      product.stock = raw.stock;
      product.salesToday = Math.max(0, raw.salesAccum - product.salesBaseline);
      product.totalSalesAccum = raw.salesAccum;
      product.isActive = true;
      await this.productRepo.save(product);
    }

    await this.snapshotRepo.save(
      this.snapshotRepo.create({
        productId: product.id,
        salesAccum: raw.salesAccum,
        price: raw.price,
        stock: raw.stock,
      }),
    );
  }

  private async cleanupOldSnapshots() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.lastCleanupDate === today) return;

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 60);
      const result = await this.snapshotRepo
        .createQueryBuilder()
        .delete()
        .where('"capturedAt" < :cutoff', { cutoff })
        .execute();
      if (result.affected && result.affected > 0) {
        this.logger.log(`Snapshots limpiados: ${result.affected} registros de más de 60 días`);
      }
      this.lastCleanupDate = today;
    } catch (err) {
      this.logger.error('Error limpiando snapshots viejos', err);
    }
  }
}

interface RawProduct {
  effiId: string;
  name: string;
  imageUrl: string;
  provider: string;
  category: string;
  subcategory: string;
  price: number;
  cost: number;
  stock: number;
  salesAccum: number;
}
