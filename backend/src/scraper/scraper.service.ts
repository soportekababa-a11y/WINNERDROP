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
const SCRAPE_INTERVAL_MS = 60 * 60 * 1000;
const PRODUCTS_PER_PAGE = 40;

const COUNTRIES: Array<{ code: string; storeName: string | null }> = [
  { code: 'RD', storeName: null },           // default store after login
  { code: 'GT', storeName: 'Guatemala 1' },  // must select this store
  { code: 'EC', storeName: 'Ecuador' },      // matches ECUADOR 1 etc.
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
    while (true) {
      try {
        await this.launchBrowser();
        await this.loginAllCountries();
        await this.runCycle();
        break;
      } catch (err) {
        this.logger.error(`Error en arranque inicial, reintentando en ${RETRY_DELAY_MS / 1000}s...`, err);
        for (const ctx of this.contexts.values()) await ctx.close().catch(() => {});
        this.contexts.clear();
        await this.browser?.close().catch(() => {});
        this.browser = null;
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }

    this.intervalHandle = setInterval(async () => {
      try {
        await this.runCycle();
      } catch (err) {
        this.logger.error('Error en ciclo, re-loginando...', err);
        try {
          for (const ctx of this.contexts.values()) await ctx.close().catch(() => {});
          this.contexts.clear();
          await this.loginAllCountries();
          await this.runCycle();
        } catch (e) {
          this.logger.error('Re-login fallido', e);
        }
      }
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

  private userAgent() {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
  }

  private async launchBrowser() {
    const executablePath = process.env.CHROMIUM_PATH || undefined;
    this.browser = await chromium.launch({ headless: true, executablePath });
  }

  private async loginAllCountries() {
    const email = this.config.get<string>('EFFI_EMAIL');
    const password = this.config.get<string>('EFFI_PASSWORD');

    for (const { code, storeName } of COUNTRIES) {
      this.logger.log(`Iniciando sesión para país: ${code}`);
      const context = await this.browser!.newContext({ userAgent: this.userAgent() });
      await this.loginContext(context, email!, password!, storeName);
      this.contexts.set(code, context);
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
      await page.locator('input[type="email"], input[placeholder*="Email"], input[placeholder*="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      // Click submit — use .first() to avoid ambiguity if multiple "Ingresar" buttons exist
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
        // RD: first option that isn't the placeholder and isn't Guatemala
        const rdItems = resultItems
          .filter({ hasNotText: /guatemala/i })
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

      // Wait for navigation away from /ingreso paths
      await page.waitForURL(url => !url.href.includes('/ingreso'), { timeout: 20000 });

      // Navigate to catalog to confirm session is active
      await page.goto(EFFI_CATALOG_URL, { waitUntil: 'networkidle', timeout: 30000 });

      if (page.url().includes('/ingreso')) {
        throw new Error(`Login fallido — redirigido a ${page.url()}`);
      }

      this.logger.log(`Sesión activa${storeName ? ` [${storeName}]` : ' [RD]'}`);
    } finally {
      await page.close();
    }
  }

  private async runCycle() {
    const start = Date.now();
    let totalProducts = 0;
    let totalPages = 0;

    for (const { code } of COUNTRIES) {
      const context = this.contexts.get(code);
      if (!context) {
        this.logger.warn(`Sin contexto para país ${code}, omitiendo`);
        continue;
      }

      this.logger.log(`Iniciando ciclo para país: ${code}`);
      const page = await context.newPage();
      try {
        const { products, pages } = await this.scrapeAllPages(page, code);
        this.logger.log(`[${code}] Scraping completo: ${products.length} productos en ${pages} páginas`);

        for (const raw of products) {
          await this.upsertProductAndSnapshot(raw, code);
        }

        if (products.length > 100) {
          const scrapedIds = products.map(p => p.effiId);
          const deactivated = await this.productRepo
            .createQueryBuilder()
            .update()
            .set({ isActive: false })
            .where('effiId NOT IN (:...ids) AND isActive = true AND country = :country', { ids: scrapedIds, country: code })
            .execute();
          if (deactivated.affected && deactivated.affected > 0) {
            this.logger.log(`[${code}] Productos desactivados: ${deactivated.affected}`);
          }
        }

        totalProducts += products.length;
        totalPages += pages;
      } finally {
        await page.close();
      }
    }

    await this.productsService.refreshDailyCache();

    this.lastScrapeStats = {
      total: totalProducts,
      pages: totalPages,
      durationMs: Date.now() - start,
      finishedAt: new Date(),
    };

    this.logger.log(`Ciclo completo (todos los países) en ${Math.round((Date.now() - start) / 1000)}s`);
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
        salesToday: raw.salesAccum,
        salesYesterday: 0,
        isActive: true,
        country,
      });
      await this.productRepo.save(product);
    } else {
      product.name = raw.name;
      product.imageUrl = raw.imageUrl;
      product.provider = raw.provider;
      product.price = raw.price;
      product.cost = raw.cost;
      product.stock = raw.stock;
      product.salesToday = raw.salesAccum;
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
