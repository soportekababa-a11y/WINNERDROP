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

  private async scrapeHtml(page: any, _keyword: string): Promise<RawAd[]> {
    return page.evaluate(() => {
      const bodyText = document.body.innerText;

      // Split body into individual ad sections by "Active\nLibrary ID:" pattern
      const rawSections = bodyText.split(/(?=\nActive\nLibrary ID:|\nActive\r?\nLibrary ID:)/);

      const ads: any[] = [];

      for (const section of rawSections) {
        if (!section.includes('Library ID:') || !section.includes('Started running')) continue;

        // Date
        const dateMatch = section.match(/Started running on (.+?)(?:\r?\n|$)/);
        if (!dateMatch) continue;
        const dateStr = dateMatch[1].trim();

        // Advertiser name: line immediately before "Sponsored"
        const sponsoredIdx = section.search(/\r?\nSponsored\r?\n/);
        if (sponsoredIdx === -1) continue;
        const beforeSponsored = section.slice(0, sponsoredIdx);
        const lines = beforeSponsored.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const advertiserName = lines[lines.length - 1] ?? '';
        if (!advertiserName || advertiserName.length > 100 || advertiserName.includes('Library ID')) continue;

        // Ad copy: text after "Sponsored\n", skip domain/URL lines
        const afterMatch = section.match(/\r?\nSponsored\r?\n([\s\S]*)/);
        const adCopyRaw = afterMatch ? afterMatch[1] : '';
        const adCopy = adCopyRaw
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(l =>
            l.length > 0 &&
            l.length < 300 &&
            !/\.(com|do|net|org|io)\b/i.test(l) &&
            !/^https?:\/\//i.test(l) &&
            !/^shop now$/i.test(l) &&
            !/^get offer$/i.test(l) &&
            !/^see more$/i.test(l)
          )
          .slice(0, 10)
          .join(' ')
          .trim()
          .slice(0, 600);

        // Video detection: timestamp pattern "0:00 / 0:46"
        const hasVideo = /\d+:\d+\s*\/\s*\d+:\d+/.test(section);

        // Days active
        let daysActive = 0;
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          daysActive = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86400000));
        }

        ads.push({ advertiserName, pageUrl: null, format: hasVideo ? 'video' : 'image', platforms: ['facebook'], startDateRaw: dateStr, daysActive, adCopy });
      }

      // Match FB page links to ads
      const pageLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="facebook.com/"]'))
        .filter(a => {
          const href = a.href ?? '';
          const text = a.textContent?.trim() ?? '';
          return href.includes('facebook.com/') &&
            !href.includes('l.facebook.com') &&
            !href.includes('/ads/library') &&
            !href.includes('/help') &&
            !href.includes('/policies') &&
            text.length > 0 &&
            text.length < 70 &&
            !/\.(com|do|net|org)\b/i.test(text) &&
            !/^https?:\/\//i.test(text);
        });

      const seenHrefs = new Set<string>();
      const uniqueLinks = pageLinks.filter(a => {
        if (seenHrefs.has(a.href)) return false;
        seenHrefs.add(a.href);
        return true;
      }).map(a => ({ text: a.textContent?.trim() ?? '', href: a.href }));

      // Match by name first, then by order
      for (const ad of ads) {
        const match = uniqueLinks.find(l => l.text.toLowerCase() === ad.advertiserName.toLowerCase());
        if (match) ad.pageUrl = match.href;
      }
      ads.forEach((ad, i) => {
        if (!ad.pageUrl && uniqueLinks[i]) ad.pageUrl = uniqueLinks[i].href;
      });

      return ads;
    });
  }
}
