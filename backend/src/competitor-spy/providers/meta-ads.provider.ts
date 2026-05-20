import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, BrowserContext } from 'playwright';
import { RawAd, AdFormat } from '../dto/spy-result.dto';
import { PlatformConfig } from '../config/platforms.config';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

@Injectable()
export class MetaAdsProvider {
  private readonly logger = new Logger(MetaAdsProvider.name);

  async scrape(keyword: string, platform: PlatformConfig, countryCode: string): Promise<RawAd[]> {
    const url = platform.buildSearchUrl(keyword, countryCode);
    this.logger.log(`Scraping: ${url}`);

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const context: BrowserContext = await browser.newContext({ userAgent: UA });
      const page = await context.newPage();

      // Intercept JSON API responses from Meta
      const apiResponses: any[] = [];
      page.on('response', async (response) => {
        const respUrl = response.url();
        if (
          respUrl.includes('facebook.com') &&
          response.status() === 200 &&
          (response.headers()['content-type'] ?? '').includes('json')
        ) {
          try {
            const text = await response.text();
            if (text.startsWith('{') || text.startsWith('[')) {
              apiResponses.push(JSON.parse(text));
            }
          } catch {}
        }
      });

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(6000); // Let React render + API calls complete

      // Try to parse API responses first (more reliable)
      const adsFromApi = this.parseApiResponses(apiResponses);
      if (adsFromApi.length > 0) {
        this.logger.log(`[${keyword}] Got ${adsFromApi.length} ads from API responses`);
        return adsFromApi;
      }

      // Fallback: scrape rendered HTML
      const adsFromHtml = await this.scrapeHtml(page, keyword);
      this.logger.log(`[${keyword}] Got ${adsFromHtml.length} ads from HTML`);
      return adsFromHtml;
    } catch (err: any) {
      this.logger.warn(`Scrape failed for "${keyword}": ${err.message}`);
      return [];
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  private parseApiResponses(responses: any[]): RawAd[] {
    const ads: RawAd[] = [];

    for (const resp of responses) {
      try {
        // Meta GraphQL responses — walk the tree looking for ad node arrays
        const nodes = this.extractNodes(resp);
        for (const node of nodes) {
          const ad = this.nodeToRawAd(node);
          if (ad) ads.push(ad);
        }
      } catch {}
    }

    return ads;
  }

  private extractNodes(obj: any, depth = 0): any[] {
    if (depth > 10 || !obj || typeof obj !== 'object') return [];
    const results: any[] = [];

    // Check if this looks like an ad node
    if (obj.page_name || obj.advertiser_name || obj.ad_archive_id) {
      results.push(obj);
    }

    // Check edges array (GraphQL pagination pattern)
    if (Array.isArray(obj.edges)) {
      for (const edge of obj.edges) {
        results.push(...this.extractNodes(edge.node ?? edge, depth + 1));
      }
    }

    // Recurse into object values
    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object') {
        results.push(...this.extractNodes(val, depth + 1));
      }
    }

    return results;
  }

  private nodeToRawAd(node: any): RawAd | null {
    const name = node.page_name ?? node.advertiser_name ?? node.title;
    if (!name || typeof name !== 'string') return null;

    const pageUrl = node.page_profile_uri ?? node.page_profile_picture_url?.split('/photos')[0] ?? null;
    const hasVideo = node.has_video ?? node.video_hd_url ?? node.video_sd_url ?? false;
    const format: AdFormat = hasVideo ? 'video' : 'image';

    const startTimestamp = node.start_date ?? node.ad_delivery_start_time;
    let daysActive = 0;
    let startDateRaw: string | null = null;
    if (startTimestamp) {
      const start = new Date(typeof startTimestamp === 'number' ? startTimestamp * 1000 : startTimestamp);
      daysActive = Math.floor((Date.now() - start.getTime()) / 86400000);
      startDateRaw = start.toISOString().slice(0, 10);
    }

    const bodyParts: string[] = node.ad_creative_bodies ?? node.ad_creative_body ?? [];
    const adCopy = Array.isArray(bodyParts) ? bodyParts.join(' ') : String(bodyParts ?? '');

    const platformsRaw: string[] = node.publisher_platforms ?? node.delivery_by_region ?? [];
    const platforms = Array.isArray(platformsRaw) ? platformsRaw.map(String) : [];

    return { advertiserName: name, pageUrl, format, platforms, startDateRaw, daysActive, adCopy };
  }

  private async scrapeHtml(page: any, keyword: string): Promise<RawAd[]> {
    return page.evaluate(() => {
      const ads: any[] = [];

      // Find all advertiser links (Facebook page links in the ads library)
      const pageLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="facebook.com/"]'))
        .filter(a => {
          const href = a.href || '';
          return href.includes('facebook.com/') &&
            !href.includes('/ads/library') &&
            !href.includes('facebook.com/help') &&
            !href.includes('facebook.com/policies') &&
            a.textContent && a.textContent.trim().length > 1;
        });

      // Try to find ad card containers
      const allText = document.body.innerText;

      // Extract "Started running on" dates
      const dateMatches = allText.match(/(?:Started running on|Empezó a publicarse el|Active since)\s+[\w\s,]+\d{4}/gi) ?? [];
      const dates = dateMatches.map(d => d.replace(/(?:Started running on|Empezó a publicarse el|Active since)\s*/i, '').trim());

      // Count videos vs images
      const videoCount = document.querySelectorAll('video').length;
      const imgCount = document.querySelectorAll('[role="img"], img:not([src*="static"])').length;

      // Extract visible text blocks (likely ad copy)
      const textBlocks = Array.from(document.querySelectorAll('div[dir="auto"]'))
        .map(el => el.textContent?.trim() ?? '')
        .filter(t => t.length > 20 && t.length < 600 && /[a-záéíóúñ]/i.test(t))
        .slice(0, 50);

      // Create ads by pairing page links with dates
      const uniqueAdvertisers = [...new Map(pageLinks.map(a => [a.textContent?.trim(), a])).entries()];

      uniqueAdvertisers.slice(0, 30).forEach(([name, link], i) => {
        const dateStr = dates[i] ?? null;
        let daysActive = 0;
        if (dateStr) {
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            daysActive = Math.floor((Date.now() - parsed.getTime()) / 86400000);
          }
        }
        ads.push({
          advertiserName: name ?? 'Unknown',
          pageUrl: link.href,
          format: i < videoCount ? 'video' : 'image',
          platforms: ['facebook'],
          startDateRaw: dateStr,
          daysActive: Math.max(0, daysActive),
          adCopy: textBlocks[i] ?? '',
        });
      });

      return ads;
    });
  }
}
