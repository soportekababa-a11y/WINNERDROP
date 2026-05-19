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
const SCRAPE_INTERVAL_MS = 60 * 60 * 1000; // 60 minutos
const PRODUCTS_PER_PAGE = 40;

@Injectable()
export class ScraperService implements OnModuleDestroy {
  private readonly logger = new Logger(ScraperService.name);
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private isRunning = false;
  private intervalHandle: NodeJS.Timeout | null = null;
  private lastScrapeStats = { total: 0, pages: 0, durationMs: 0, finishedAt: null as Date | null };
  private progress = { currentPage: 0, totalPages: 0, accumulated: 0 };

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
        await this.login();
        await this.runCycle();
        break;
      } catch (err) {
        this.logger.error(`Error en arranque inicial, reintentando en ${RETRY_DELAY_MS / 1000}s...`, err);
        await this.context?.close().catch(() => {});
        await this.browser?.close().catch(() => {});
        this.browser = null;
        this.context = null;
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }

    this.intervalHandle = setInterval(async () => {
      try {
        await this.runCycle();
      } catch (err) {
        this.logger.error('Error en ciclo, re-loginando...', err);
        try {
          await this.context?.close();
          this.context = await this.browser!.newContext({ userAgent: this.userAgent() });
          await this.login();
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
    await this.context?.close();
    await this.browser?.close();
    this.logger.log('Scraper detenido');
  }

  private userAgent() {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
  }

  private async launchBrowser() {
    const executablePath = process.env.CHROMIUM_PATH || undefined;
    this.browser = await chromium.launch({ headless: true, executablePath });
    this.context = await this.browser.newContext({ userAgent: this.userAgent() });
  }

  async login() {
    const email = this.config.get<string>('EFFI_EMAIL');
    const password = this.config.get<string>('EFFI_PASSWORD');
    const page = await this.context!.newPage();

    try {
      this.logger.log('Iniciando sesión en Effi...');
      await page.goto(EFFI_LOGIN_URL, { waitUntil: 'networkidle' });
      await page.locator('input[type="email"], input[placeholder*="Email"], input[placeholder*="email"]').fill(email!);
      await page.locator('input[type="password"]').fill(password!);
      await page.locator('button[type="submit"], button:has-text("Ingresar")').click();
      await page.waitForURL((url) => !url.href.includes('/ingreso'), { timeout: 15000 });
      this.logger.log('Sesión activa');
    } finally {
      await page.close();
    }
  }

  private async runCycle() {
    const start = Date.now();
    const page = await this.context!.newPage();

    try {
      this.logger.log('Iniciando ciclo de scraping completo...');
      const { products, pages } = await this.scrapeAllPages(page);

      this.logger.log(`Scraping completo: ${products.length} productos en ${pages} páginas`);

      for (const raw of products) {
        await this.upsertProductAndSnapshot(raw);
      }

      // Actualizar caché de ventas diarias
      await this.productsService.refreshDailyCache();

      this.lastScrapeStats = {
        total: products.length,
        pages,
        durationMs: Date.now() - start,
        finishedAt: new Date(),
      };

      this.logger.log(`Ciclo completado en ${Math.round((Date.now() - start) / 1000)}s`);
    } finally {
      await page.close();
    }
  }

  private async scrapeAllPages(page: Page): Promise<{ products: RawProduct[]; pages: number }> {
    const all: RawProduct[] = [];
    let pageNum = 1;

    // Cargar primera página y detectar total
    await page.goto(EFFI_CATALOG_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const totalText = await page.locator('text=/\\d+ Artículos/').textContent().catch(() => '');
    const totalMatch = (totalText ?? '').match(/([\d,]+)\s+Artículos/);
    const totalProducts = totalMatch ? parseInt(totalMatch[1].replace(',', '')) : 3000;
    const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);
    this.logger.log(`Total productos: ${totalProducts} | Total páginas: ${totalPages}`);

    this.progress = { currentPage: 1, totalPages, accumulated: 0 };

    while (pageNum <= totalPages) {
      const url = pageNum === 1 ? EFFI_CATALOG_URL : `${EFFI_CATALOG_URL}?page=${pageNum}`;

      if (pageNum > 1) {
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
      }

      const cards = await page.locator('.product-card').count();
      if (cards === 0) break;

      const pageProducts = await this.extractPageProducts(page);
      all.push(...pageProducts);

      this.progress = { currentPage: pageNum, totalPages, accumulated: all.length };

      if (pageNum % 10 === 0) {
        this.logger.log(`  Página ${pageNum}/${totalPages} — total acumulado: ${all.length}`);
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

          // Stats
          const labels = Array.from(card.querySelectorAll('.product-stats .label'));
          let stock = 0, salesAccum = 0;
          labels.forEach(label => {
            const text = label.textContent ?? '';
            const stockM = text.match(/Stock:\s*([\d,]+)/);
            const salesM = text.match(/Ventas:\s*([\d,]+)/);
            if (stockM) stock      = parseInt(stockM[1].replace(/,/g, ''));
            if (salesM) salesAccum = parseInt(salesM[1].replace(/,/g, ''));
          });

          // Precio
          const priceText = card.querySelector('.price-block')?.textContent ?? '';
          const costoM    = priceText.match(/Costo[:\s]+(?:RD\$)?\s*([\d,.]+)/i);
          const sugeridoM = priceText.match(/Sugerido[:\s]+(?:RD\$)?\s*([\d,.]+)/i);
          const cost  = costoM    ? parseFloat(costoM[1].replace(/,/g, ''))    : 0;
          const price = sugeridoM ? parseFloat(sugeridoM[1].replace(/,/g, '')) : cost;

          // Proveedor, categoría, subcategoría
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

  private async upsertProductAndSnapshot(raw: RawProduct) {
    let product = await this.productRepo.findOne({ where: { effiId: raw.effiId } });

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
        salesToday: 0,
        salesYesterday: 0,
        isActive: true,
      });
    } else {
      product.name = raw.name;
      product.imageUrl = raw.imageUrl;
      product.provider = raw.provider;
      product.price = raw.price;
      product.cost = raw.cost;
      product.stock = raw.stock;
      product.totalSalesAccum = raw.salesAccum;
      product.isActive = true;
    }

    await this.productRepo.save(product);

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
