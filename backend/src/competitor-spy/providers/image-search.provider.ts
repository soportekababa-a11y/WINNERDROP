import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, BrowserContext } from 'playwright';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const EXCLUDED = /\b(google\.|bing\.|duckduckgo\.|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|youtube\.com|pinterest\.com|aliexpress\.com|alibaba\.com|amazon\.|mercadolibre\.|mlstatic\.|ebay\.com|wikipedia\.|wikimedia\.|effi\.|dhgate\.|cjdropshipping\.|olx\.|listado\.mercado)\b/i;
const SHOPIFY = /myshopify\.com|\/products\//i;

const RD_CURRENCY = /RD\$|pesos\s+dominicanos|\bDOP\b/i;
const RD_GEO      = /rep[uú]blica\s+dominicana|santo\s+domingo|santiago\s+de\s+los|toda?\s*l?a?\s*RD\b|env[ií]os?\s+(a\s+)?RD\b|todo\s+RD\b/i;
const RD_PHONE    = /\b(809|829|849)[\s\-]?\d{3}[\s\-]?\d{4}/;
const RD_SHIPPING = /entrega\s+(en\s+)?santo\s+domingo|delivery\s+RD|env[ií]o\s+gratis\s+(a\s+)?RD|pedidos?\s+a\s+todo\s+RD/i;
const RD_SLANG    = /\bvaina\b|\btig[uú]ere\b|\bbregando\b|\bjeva\b|\bta\s+bien\b|\bpana\b/i;

function isDominicanDomain(hostname: string): boolean {
  if (/\.do$/i.test(hostname)) return true;
  const base = hostname.replace(/\.(com|net|org|shop|store|co|io|biz|info)(\.\w+)?$/i, '');
  if (/rd$/i.test(base)) return true;
  if (/\b(dominicana?|dominicano|republica)\b/i.test(hostname)) return true;
  return false;
}

function dominicanContentScore(text: string): number {
  let score = 0;
  if (RD_CURRENCY.test(text))  score += 15;
  if (RD_GEO.test(text))       score += 10;
  if (RD_PHONE.test(text))     score += 8;
  if (RD_SHIPPING.test(text))  score += 8;
  if (RD_SLANG.test(text))     score += 5;
  return score;
}

function cleanProductName(name: string): string {
  return name
    .replace(/\(bodega\s+\w+\)/gi, '')
    .replace(/\bbodega\s+\w+\b/gi, '')
    .replace(/\(\d+\s*(unidades?|caps?[uú]las?|ml|mg|gr?|kg|piezas?|pack|kit)\)/gi, '')
    .replace(/\d+\s*(unidades?|caps?[uú]las?|ml|mg|gr?|kg|piezas?|pack|kit)\b/gi, '')
    .replace(/\s+/g, ' ').trim().slice(0, 60);
}

@Injectable()
export class ImageSearchProvider {
  private readonly logger = new Logger(ImageSearchProvider.name);

  async findCompetitors(productName: string): Promise<string[]> {
    if (!productName) return [];

    const cleaned = cleanProductName(productName);
    this.logger.log(`Searching competitors for: "${cleaned}"`);

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const context = await browser.newContext({ userAgent: UA });

      const queries = [
        `${cleaned} comprar República Dominicana`,
        `${cleaned} tienda dominicana precio`,
      ];

      const candidates = await this.searchDuckDuckGo(context, queries);
      this.logger.log(`DDG candidates: ${candidates.length}`);
      if (candidates.length === 0) return [];

      const scored = await this.scoreByContent(context, candidates);
      scored.sort((a, b) => b.score - a.score);

      const results = scored.filter(r => r.score > 0).slice(0, 10).map(r => r.url);
      this.logger.log(`Competitor URLs: ${results.length}`);
      return results;
    } catch (err: any) {
      this.logger.warn(`Competitor search failed: ${err.message}`);
      return [];
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  private async searchDuckDuckGo(
    context: BrowserContext,
    queries: string[],
  ): Promise<{ url: string; domainScore: number }[]> {
    const seen = new Set<string>();
    const results: { url: string; domainScore: number }[] = [];

    for (const q of queries) {
      const page = await context.newPage();
      try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=do-es`;
        this.logger.log(`DDG query: "${q}"`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);

        const links: string[] = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('a.result__a, a.result__url'));
          return anchors.map(a => {
            const href = (a as HTMLAnchorElement).href;
            try {
              const u = new URL(href);
              const uddg = u.searchParams.get('uddg');
              if (uddg) return decodeURIComponent(uddg);
            } catch {}
            return href;
          }).filter(h => h.startsWith('http'));
        });

        for (const link of links) {
          try {
            const u = new URL(link);
            const host = u.hostname.toLowerCase();
            if (EXCLUDED.test(host)) continue;
            if (seen.has(host)) continue;
            seen.add(host);

            let score = 0;
            if (isDominicanDomain(host)) score += 10;
            if (SHOPIFY.test(link)) score += 6;
            if (/\/products?\/|\/tienda|\/collections\/|\/shop\/|\/comprar\//.test(u.pathname)) score += 3;

            results.push({ url: link, domainScore: score });
          } catch {}
        }
      } catch (e: any) {
        this.logger.warn(`DDG query failed: ${e.message}`);
      } finally {
        await page.close().catch(() => {});
      }
    }

    return results.slice(0, 14);
  }

  private async scoreByContent(
    context: BrowserContext,
    candidates: { url: string; domainScore: number }[],
  ): Promise<{ url: string; score: number }[]> {
    const BATCH = 3;
    const results: { url: string; score: number }[] = [];

    for (let i = 0; i < candidates.length; i += BATCH) {
      const batch = candidates.slice(i, i + BATCH);
      const batchResults = await Promise.all(
        batch.map(async ({ url, domainScore }) => {
          const page = await context.newPage();
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
            const text: string = await page.evaluate(
              () => document.body?.innerText?.slice(0, 3000) ?? '',
            );
            const contentScore = dominicanContentScore(text);
            const total = domainScore + contentScore;
            this.logger.log(`  ${new URL(url).hostname} → domain:${domainScore} content:${contentScore} total:${total}`);
            return { url, score: total };
          } catch {
            return { url, score: domainScore };
          } finally {
            await page.close().catch(() => {});
          }
        }),
      );
      results.push(...batchResults);
    }

    return results;
  }
}
