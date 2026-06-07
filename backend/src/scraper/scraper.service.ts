import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { Product } from '../products/product.entity';
import { Snapshot } from '../snapshots/snapshot.entity';
import { ProductsService } from '../products/products.service';
import { DropisService, DROPI_COUNTRIES } from './dropi.service';

const EFFI_LOGIN_URL = 'https://effi.com.co/ingreso';
const EFFI_CATALOG_URL = 'https://effi.com.co/app/articulo_dropshipping';
const PRODUCTS_PER_PAGE = 40;
const SESSION_DIR = '/opt/winnerdrop/sessions';

// Business day resets at 3:00 AM RD (UTC-4) = 7:00 AM UTC
function businessDay(): string {
  const now = new Date();
  const adjusted = new Date(now);
  if (now.getUTCHours() < 7) adjusted.setUTCDate(adjusted.getUTCDate() - 1);
  return adjusted.toISOString().slice(0, 10);
}

const COUNTRIES: Array<{ code: string; storeName: string | null }> = [
  { code: 'RD', storeName: null },
  { code: 'GT', storeName: 'Guatemala 1' },
  { code: 'EC', storeName: 'Ecuador' },
  { code: 'CR', storeName: 'Costa Rica' },
  { code: 'CO', storeName: 'Colombia' },
];

@Injectable()
export class ScraperService implements OnModuleDestroy {
  private readonly logger = new Logger(ScraperService.name);
  private browser: Browser | null = null;
  private isRunning = false;
  private lastScrapeStats = { total: 0, pages: 0, durationMs: 0, finishedAt: null as Date | null };
  private progress = { currentPage: 0, totalPages: 0, accumulated: 0, country: '' };
  private lastCleanupDate = '';
  private isCycleRunning = false;

  constructor(
    private config: ConfigService,
    private productsService: ProductsService,
    private dropisService: DropisService,
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
    while (true) {
      try {
        await this.launchBrowser();
        break;
      } catch (err) {
        this.logger.error(`No se pudo lanzar el browser, reintentando en ${RETRY_DELAY_MS / 1000}s...`, err);
        await this.browser?.close().catch(() => {});
        this.browser = null;
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
    }
    this.runLoop();
  }

  private async runLoop() {
    while (this.isRunning) {
      await this.runCycle().catch(err => this.logger.error('Error en ciclo', err));
    }
  }

  async stop() {
    this.isRunning = false;
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.logger.log('Scraper detenido');
  }

  // kept for backward-compat (API endpoint calls this)
  async login() {
    this.logger.log('login() llamado — el próximo ciclo re-logueará todos los países');
  }

  private userAgent() {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
  }

  private async launchBrowser() {
    const { existsSync } = await import('fs');
    const candidates = [
      process.env.CHROMIUM_PATH,
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
    this.browser = await chromium.launch({ headless: true, executablePath });
  }

  private isBrowserDead(): boolean {
    return !this.browser || !this.browser.isConnected();
  }

  private async ensureBrowser(): Promise<boolean> {
    if (!this.isBrowserDead()) return true;
    this.logger.warn('Browser muerto — relanzando Chromium...');
    await this.browser?.close().catch(() => {});
    this.browser = null;
    try {
      await this.launchBrowser();
      return true;
    } catch (err) {
      this.logger.error('No se pudo relanzar browser', err);
      return false;
    }
  }

  private sessionPath(code: string) {
    return `${SESSION_DIR}/session-${code}.json`;
  }

  private async saveSession(code: string, context: BrowserContext) {
    try {
      const { writeFile, mkdir } = await import('fs/promises');
      await mkdir(SESSION_DIR, { recursive: true });
      const state = await context.storageState();
      await writeFile(this.sessionPath(code), JSON.stringify(state));
      this.logger.log(`[${code}] Sesión guardada en disco`);
    } catch (err) {
      this.logger.warn(`[${code}] No se pudo guardar sesión`, err);
    }
  }

  private async loadSession(code: string): Promise<object | null> {
    try {
      const { readFile } = await import('fs/promises');
      const raw = await readFile(this.sessionPath(code), 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async clearSession(code: string) {
    try {
      const { unlink } = await import('fs/promises');
      await unlink(this.sessionPath(code));
      this.logger.log(`[${code}] Sesión guardada borrada`);
    } catch {}
  }

  // Login to one country and return its context. Caller must close() when done.
  private async loginForCountry(
    code: string,
    storeName: string | null,
    email: string,
    password: string,
  ): Promise<BrowserContext | null> {
    // Try restoring saved session first
    const savedState = await this.loadSession(code);
    if (savedState) {
      try {
        this.logger.log(`[${code}] Restaurando sesión guardada...`);
        const context = await this.browser!.newContext({ userAgent: this.userAgent(), storageState: savedState as any });
        const page = await context.newPage();
        try {
          await page.route('**', (route) => {
            const rt = route.request().resourceType();
            if (['image', 'media', 'font', 'stylesheet'].includes(rt)) route.abort().catch(() => {});
            else route.continue().catch(() => {});
          });
          await page.goto(EFFI_CATALOG_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(1000);
          if (!page.url().includes('/ingreso')) {
            this.logger.log(`[${code}] Sesión restaurada OK`);
            await page.goto('about:blank').catch(() => {});
            await page.close().catch(() => {});
            return context;
          }
          this.logger.warn(`[${code}] Sesión guardada expiró — haciendo login completo`);
        } finally {
          await page.goto('about:blank').catch(() => {});
          await page.close().catch(() => {});
        }
        await context.close().catch(() => {});
      } catch (err) {
        this.logger.warn(`[${code}] Fallo al restaurar sesión — haciendo login completo`, err);
      }
      await this.clearSession(code);
    }

    // Full login with retries
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (this.isBrowserDead()) {
        this.logger.warn(`[${code}] Browser muerto antes de intento ${attempt} — relanzando...`);
        if (!await this.ensureBrowser()) return null;
      }

      let context: BrowserContext | null = null;
      try {
        this.logger.log(`[${code}] Login completo${attempt > 1 ? ` (intento ${attempt})` : ''}...`);
        context = await this.browser!.newContext({ userAgent: this.userAgent() });
        await this.loginContext(context, email, password, storeName);
        await this.saveSession(code, context);
        return context;
      } catch (err) {
        await context?.close().catch(() => {});
        if (attempt < MAX_ATTEMPTS) {
          this.logger.warn(`[${code}] Login intento ${attempt} fallido, reintentando en 5s...`);
          await new Promise(r => setTimeout(r, 5000));
        } else {
          this.logger.error(`[${code}] Login fallido tras ${MAX_ATTEMPTS} intentos — omitido`, err);
        }
      }
    }
    return null;
  }

  private async loginContext(context: BrowserContext, email: string, password: string, storeName: string | null) {
    const page = await context.newPage();
    try {
      await page.goto(EFFI_LOGIN_URL, { waitUntil: 'networkidle' });
      await page.locator('input[type="email"], input[placeholder*="Email"], input[placeholder*="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.locator('button[type="submit"], button:has-text("Ingresar")').first().click();

      await page.waitForURL('**/ingreso/validar_usuario', { timeout: 20000 });

      // Effi uses jQuery Chosen — native <select> is hidden
      const chosenContainer = page.locator('.chosen-container').first();
      await chosenContainer.waitFor({ state: 'visible', timeout: 10000 });
      await chosenContainer.click();

      const resultItems = page.locator('.chosen-results li.active-result');
      await resultItems.first().waitFor({ state: 'visible', timeout: 5000 });

      const optionTexts = await resultItems.allTextContents();
      this.logger.log(`[${storeName ?? 'RD'}] Empresas: ${JSON.stringify(optionTexts)}`);

      if (storeName) {
        const match = resultItems.filter({ hasText: new RegExp(storeName, 'i') });
        if (await match.count() > 0) {
          const text = await match.first().textContent();
          await match.first().click();
          this.logger.log(`Empresa seleccionada: "${text?.trim()}"`);
        } else {
          this.logger.warn(`No se encontró empresa "${storeName}". Opciones: ${JSON.stringify(optionTexts)}`);
          await resultItems.first().click();
        }
      } else {
        // RD: exclude Guatemala, Costa Rica, Ecuador, Colombia, placeholder
        const rdItems = resultItems
          .filter({ hasNotText: /guatemala/i })
          .filter({ hasNotText: /costa rica/i })
          .filter({ hasNotText: /ecuador/i })
          .filter({ hasNotText: /colombia/i })
          .filter({ hasNotText: /seleccione/i });
        if (await rdItems.count() > 0) {
          const text = await rdItems.first().textContent();
          await rdItems.first().click();
          this.logger.log(`Empresa RD seleccionada: "${text?.trim()}"`);
        } else {
          const text = await resultItems.nth(1).textContent().catch(() => '?');
          await resultItems.nth(1).click();
          this.logger.log(`Empresa RD seleccionada (fallback): "${text?.trim()}"`);
        }
      }

      await page.locator('button:has-text("Ingresar")').click();
      await page.waitForURL(url => !url.href.includes('/ingreso'), { timeout: 20000 });

      // Block heavy resources before verifying catalog — prevents Chrome OOM
      await page.route('**', (route) => {
        const rt = route.request().resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(rt)) route.abort().catch(() => {});
        else route.continue().catch(() => {});
      });
      await page.goto(EFFI_CATALOG_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1000);

      if (page.url().includes('/ingreso')) {
        throw new Error(`Login fallido — redirigido a ${page.url()}`);
      }

      this.logger.log(`Sesión activa${storeName ? ` [${storeName}]` : ' [RD]'}`);
      await page.goto('about:blank').catch(() => {});
    } finally {
      await page.close();
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
      // Start Dropi in parallel with Effi — independent browser, independent DB rows
      const dropiPromise = Promise.all(
        DROPI_COUNTRIES.map(def =>
          this.dropisService.scrapeCountry(def).catch(err =>
            this.logger.error(`[Dropi:${def.code}] Error en ciclo`, err),
          ),
        ),
      );

      for (const { code, storeName } of COUNTRIES) {
        let countryDone = false;
        for (let attempt = 1; attempt <= 3 && !countryDone; attempt++) {
          if (attempt > 1) {
            this.logger.warn(`[${code}] Reintentando (intento ${attempt}/3)...`);
            await new Promise(r => setTimeout(r, 5000));
          }

          if (!await this.ensureBrowser()) {
            this.logger.error(`Browser no disponible — omitiendo ${code}`);
            break;
          }

        let context: BrowserContext | null = null;
        try {
          context = await this.loginForCountry(code, storeName, email, password);
          if (!context) {
            this.logger.error(`[${code}] Login fallido intento ${attempt}`);
            continue;
          }

          this.logger.log(`[${code}] Iniciando scrape`);
          const page = await context.newPage();
          let products: RawProduct[] = [];
          let pages = 0;
          try {
            const result = await this.scrapeAllPages(page, code);
            products = result.products;
            pages = result.pages;
          } finally {
            await page.close().catch(() => {});
          }

          this.logger.log(`[${code}] ${products.length} productos — escribiendo a BD`);
          let saved = 0;
          const yesterdayUpdates: Array<{ id: string; salesYesterday: number }> = [];
          for (const raw of products) {
            try {
              const pending = await this.upsertProductAndSnapshot(raw, code);
              if (pending) yesterdayUpdates.push(pending);
              saved++;
            } catch (dbErr) {
              this.logger.error(`[${code}] Error guardando ${raw.effiId}`, dbErr);
            }
          }

          // Apply salesYesterday all at once — avoids partial state visible mid-cycle
          if (yesterdayUpdates.length > 0) {
            this.logger.log(`[${code}] Actualizando ventas ayer: ${yesterdayUpdates.length} productos`);
            await Promise.all(
              yesterdayUpdates.map(({ id, salesYesterday }) =>
                this.productRepo.update(id, { salesYesterday }).catch(err =>
                  this.logger.error(`[${code}] Error en salesYesterday id=${id}`, err),
                ),
              ),
            );
          }

          if (products.length > 100) {
            const ids = products.map(p => p.effiId);
            await this.productRepo
              .createQueryBuilder()
              .update()
              .set({ isActive: false })
              .where('"effiId" NOT IN (:...ids) AND "isActive" = true AND country = :country', { ids, country: code })
              .execute()
              .catch(err => this.logger.error(`[${code}] Error desactivando productos viejos`, err));
          }

          totalProducts += saved;
          totalPages += pages;
          this.logger.log(`[${code}] ${saved}/${products.length} guardados en ${pages} páginas`);
          countryDone = true;

        } catch (err) {
          this.logger.error(`[${code}] Error intento ${attempt} — ${err}`, err);
        } finally {
          await context?.close().catch(() => {});
        }
        } // end retry loop
      }

      // Wait for Dropi to finish (was running in parallel with Effi)
      await dropiPromise;

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

    await page.route('**', (route) => {
      const rt = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(rt)) {
        route.abort().catch(() => {});
      } else {
        route.continue().catch(() => {});
      }
    });

    await page.goto(EFFI_CATALOG_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    if (page.url().includes('/ingreso')) {
      throw new Error(`Sesión expiró durante scraping — redirigido a ${page.url()}`);
    }

    const totalText = await page.locator('text=/\\d+ Artículos/').textContent().catch(() => '');
    const totalMatch = (totalText ?? '').match(/([\d,]+)\s+Artículos/);
    const totalProducts = totalMatch ? parseInt(totalMatch[1].replace(',', '')) : 3000;
    const totalPagesCount = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);
    this.logger.log(`[${country}] Total productos: ${totalProducts} | Total páginas: ${totalPagesCount}`);

    this.progress = { currentPage: 1, totalPages: totalPagesCount, accumulated: 0, country };

    while (pageNum <= totalPagesCount) {
      const url = pageNum === 1 ? EFFI_CATALOG_URL : `${EFFI_CATALOG_URL}?page=${pageNum}`;

      if (pageNum > 1) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
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

  // Returns pending salesYesterday update when the business day rolled over.
  // Caller batches these and applies them at end of cycle so the dashboard never
  // shows a partial salesYesterday state mid-scrape.
  private async upsertProductAndSnapshot(
    raw: RawProduct,
    country: string,
  ): Promise<{ id: string; salesYesterday: number } | null> {
    let product = await this.productRepo.findOne({ where: { effiId: raw.effiId, country } });

    const today = businessDay();
    let pendingYesterday: { id: string; salesYesterday: number } | null = null;

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
        if (dayGap === 1) {
          pendingYesterday = { id: product.id, salesYesterday: Math.max(0, raw.salesAccum - product.salesBaseline) };
        }
        // salesYesterday NOT written here — applied in bulk at end of cycle
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

    return pendingYesterday;
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
