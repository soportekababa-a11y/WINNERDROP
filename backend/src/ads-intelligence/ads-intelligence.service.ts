import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import * as crypto from 'crypto';
import { AdIntelligenceCache } from './entities/ad-intelligence-cache.entity';

const CACHE_TTL_HOURS = 24;

const COUNTRY_META: Record<string, string> = {
  RD: 'DO', DO: 'DO', GT: 'GT', EC: 'EC', CR: 'CR',
  CO: 'CO', CL: 'CL', MX: 'MX', US: 'US', AR: 'AR', PE: 'PE',
};

export interface AdResult {
  id: string;
  copy: string;
  title: string;
  caption: string;
  pageName: string;
  pageId: string;
  startDate: string;
  daysActive: number;
  snapshotUrl: string;
  platforms: string[];
  angle: string;
  insights: string[];
}

export interface IntelligenceResult {
  queries: string[];
  productCategory: string;
  mainKeywords: string[];
  ads: AdResult[];
  overallInsights: string[];
  dominantAngle: string;
  totalFound: number;
  cachedAt?: string;
}

@Injectable()
export class AdsIntelligenceService {
  private readonly logger = new Logger(AdsIntelligenceService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AdIntelligenceCache)
    private readonly cacheRepo: Repository<AdIntelligenceCache>,
  ) {
    this.anthropic = new Anthropic({ apiKey: config.get('CLAUDE_API_KEY') });
  }

  async analyze(
    productName: string,
    imageBase64: string | null,
    country: string,
    _userId: string,
    forceRefresh = false,
  ): Promise<IntelligenceResult> {
    const isoCountry = COUNTRY_META[country.toUpperCase()] ?? country.toUpperCase();
    const cacheKey = crypto.createHash('md5')
      .update(`${productName.toLowerCase().trim()}|${isoCountry}`)
      .digest('hex');

    if (!forceRefresh) {
      const cached = await this.cacheRepo.findOne({ where: { cacheKey } });
      if (cached) {
        const ageHours = (Date.now() - cached.updatedAt.getTime()) / 3600000;
        if (ageHours < CACHE_TTL_HOURS) {
          this.logger.log(`Cache hit: ${productName} / ${isoCountry}`);
          return { ...(cached.results as IntelligenceResult), cachedAt: cached.updatedAt.toISOString() };
        }
      }
    }

    const queryData = await this.generateQueries(productName, imageBase64);
    const rawAds = await this.searchAdsViaPlaywright(queryData.queries, isoCountry);
    const result = await this.analyzeAds(rawAds, productName, queryData);

    const safeResult = this.stripSurrogates(result);

    const existing = await this.cacheRepo.findOne({ where: { cacheKey } });
    if (existing) {
      existing.results = safeResult as any;
      existing.queries = queryData.queries;
      await this.cacheRepo.save(existing);
    } else {
      await this.cacheRepo.save(
        this.cacheRepo.create({ cacheKey, productName, country: isoCountry, results: safeResult as any, queries: queryData.queries }),
      );
    }

    return safeResult;
  }

  private stripSurrogates<T>(obj: T): T {
    const json = JSON.stringify(obj);
    // Remove any lone or paired surrogates — PostgreSQL JSONB rejects them
    const clean = json.replace(/\\ud[89ab][0-9a-f]{2}\\ud[c-f][0-9a-f]{2}|\\ud[89ab-f][0-9a-f]{3}/gi, '');
    return JSON.parse(clean);
  }

  // ─── private ─────────────────────────────────────────────────────────────

  private async generateQueries(
    productName: string,
    imageBase64: string | null,
  ): Promise<{ queries: string[]; productCategory: string; mainKeywords: string[] }> {
    const content: Anthropic.Messages.ContentBlockParam[] = [];
    if (imageBase64) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
      });
    }
    content.push({
      type: 'text',
      text: `Producto: "${productName}"
${imageBase64 ? 'Analiza la imagen del producto para mejorar las queries.' : ''}

Genera queries de búsqueda para encontrar anuncios activos de este producto en Meta Ads Library.

Responde SOLO JSON válido sin markdown:
{
  "queries": ["query1","query2","query3","query4","query5"],
  "productCategory": "categoría",
  "mainKeywords": ["kw1","kw2","kw3"]
}

Reglas:
- 5 queries variadas: nombre exacto + sinónimos + inglés + términos dropshipping
- Natural, como buscaría un competidor
- Ejemplo "masajeador cervical": ["cervical massager","neck massager ad","masajeador cervical","muscle pain device","masajeador electrico ad"]`,
    });

    const res = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content }],
    });

    const raw = (res.content[0] as Anthropic.Messages.TextBlock).text
      .replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(raw);
  }

  private async searchAdsViaPlaywright(queries: string[], isoCountry: string): Promise<any[]> {
    const playwright = require('playwright');

    const { existsSync } = require('fs');
    const executablePath = [
      process.env.CHROMIUM_PATH,
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/opt/google/chrome/chrome',
    ].filter(Boolean).find((p) => existsSync(p as string)) as string | undefined;

    const browser = await playwright.chromium.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const seen = new Set<string>();
    const all: any[] = [];

    try {
      for (const query of queries) {
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          locale: 'en-US',
          viewport: { width: 1280, height: 800 },
        });
        const page = await context.newPage();
        const graphqlTexts: string[] = [];

        page.on('response', async (res: any) => {
          if (res.url().includes('/api/graphql') && res.status() === 200) {
            try { graphqlTexts.push(await res.text()); } catch {}
          }
        });

        const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${isoCountry}&q=${encodeURIComponent(query)}&media_type=all&search_type=keyword_unordered`;

        try {
          await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });

          // Dismiss cookie consent if present
          try {
            const cookieBtn = page.locator('button[data-cookiebanner="accept_button"], button:has-text("Allow all cookies"), button:has-text("Accept all")');
            if (await cookieBtn.isVisible({ timeout: 3000 })) {
              await cookieBtn.first().click();
              await page.waitForTimeout(1500);
            }
          } catch {}

          // Scroll down multiple times to trigger lazy-loading of more ads
          for (let s = 0; s < 6; s++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(1200);
          }
        } catch (e: any) {
          this.logger.warn(`Navigation failed [${query}]: ${String(e.message).slice(0, 100)}`);
        }

        // Primary: DOM extraction (results are server-side rendered)
        const domAds = await this.extractAdsFromDOM(page);
        for (const ad of domAds) {
          if (!seen.has(ad.id)) { seen.add(ad.id); all.push(ad); }
        }

        // Secondary: parse any intercepted GraphQL responses
        for (const text of graphqlTexts) {
          const ads = this.parseGraphQLResponse(text);
          for (const ad of ads) {
            if (!seen.has(ad.id)) { seen.add(ad.id); all.push(ad); }
          }
        }

        this.logger.log(`Query "${query}" → ${domAds.length} DOM ads, total ${all.length}`);

        await context.close();
        if (all.length >= 60) break;
        await new Promise(r => setTimeout(r, 800));
      }
    } finally {
      await browser.close();
    }

    return all;
  }

  private parseGraphQLResponse(text: string): any[] {
    const stripped = text.replace(/^for\s*\(\s*;;\s*\)\s*;/, '').trim();

    const extractEdges = (json: any): any[] | null => {
      return (
        json?.data?.ad_library_main?.search_results_connection?.edges ??
        json?.data?.ad_library_main_search_connection?.edges ??
        json?.data?.node?.search_results_connection?.edges ??
        null
      );
    };

    const mapEdges = (edges: any[]): any[] =>
      edges.map((edge: any) => {
        const node = edge.node ?? edge;
        const snapshot = node.snapshot ?? {};
        const cardBody = (snapshot.cards ?? [])[0]?.body?.text ?? '';
        const mainBody =
          snapshot.body?.markup?.__html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ??
          snapshot.body?.text ??
          cardBody ??
          '';

        const archiveId = node.adArchiveID ?? node.ad_archive_id;
        return {
          id: String(archiveId ?? Math.random()),
          ad_creative_bodies: [mainBody].filter(Boolean),
          ad_creative_link_titles: [snapshot.title ?? ''].filter(Boolean),
          ad_creative_link_captions: [snapshot.caption ?? ''].filter(Boolean),
          ad_delivery_start_time: node.startDate
            ? new Date(node.startDate * 1000).toISOString().slice(0, 10)
            : '',
          ad_snapshot_url: archiveId
            ? `https://www.facebook.com/ads/library/?id=${archiveId}`
            : '',
          page_name: node.pageName ?? node.page_name ?? 'Desconocido',
          page_id: String(node.pageID ?? node.page_id ?? ''),
          publisher_platforms: node.publisherPlatform ?? node.publisher_platform ?? [],
        };
      });

    const tryLine = (s: string): any[] => {
      try {
        const json = JSON.parse(s);
        const edges = extractEdges(json);
        return edges && edges.length > 0 ? mapEdges(edges) : [];
      } catch { return []; }
    };

    const lines = stripped.split('\n').filter(l => l.trim().startsWith('{'));
    for (const line of lines) {
      const ads = tryLine(line);
      if (ads.length > 0) return ads;
    }
    return tryLine(stripped);
  }

  private async extractAdsFromDOM(page: any): Promise<any[]> {
    try {
      return await page.evaluate(() => {
        const results: any[] = [];
        const seen = new Set<string>();

        // Walk all text nodes to find "Library ID: XXXXXX"
        const walker = (document as any).createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node: Text | null;
        while ((node = walker.nextNode() as Text | null)) {
          if (!node.textContent?.includes('Library ID')) continue;

          // Walk up to find the ad card container (has enough text)
          let container = node.parentElement;
          for (let i = 0; i < 12 && container; i++) {
            const t = (container as HTMLElement).innerText ?? '';
            if (t.length > 150 && t.includes('Library ID') && t.includes('Started running')) break;
            container = container.parentElement;
          }
          if (!container) continue;

          const fullText = (container as HTMLElement).innerText ?? '';
          if (!fullText.includes('Library ID')) continue;

          const idMatch = fullText.match(/Library ID:\s*(\d+)/);
          const id = idMatch?.[1] ?? '';
          if (!id || seen.has(id)) continue;
          seen.add(id);

          const dateMatch = fullText.match(/Started running on\s+([^\n|]+)/);
          const startDate = dateMatch?.[1]?.trim() ?? '';

          // Page name: appears after "See ad details" or before "Sponsored"
          const sponsoredIdx = fullText.indexOf('Sponsored');
          const detailsIdx = fullText.indexOf('See ad details');
          let pageName = 'Desconocido';
          if (detailsIdx >= 0 && sponsoredIdx > detailsIdx) {
            pageName = fullText.slice(detailsIdx + 14, sponsoredIdx).replace(/[|\n\s]+/g, ' ').trim();
          }

          // Ad copy: text after "Sponsored"
          let copy = '';
          if (sponsoredIdx >= 0) {
            copy = fullText.slice(sponsoredIdx + 9).replace(/\s+/g, ' ').trim().slice(0, 500);
          }

          // Archive URL
          const snapshotUrl = `https://www.facebook.com/ads/library/?id=${id}`;

          results.push({
            id,
            ad_creative_bodies: copy ? [copy] : [],
            ad_creative_link_titles: [],
            ad_creative_link_captions: [],
            ad_delivery_start_time: startDate,
            ad_snapshot_url: snapshotUrl,
            page_name: pageName,
            page_id: '',
            publisher_platforms: ['facebook'],
          });

          if (results.length >= 50) break;
        }

        return results;
      });
    } catch (e: any) {
      this.logger.warn(`DOM extraction failed: ${e.message}`);
      return [];
    }
  }

  private async analyzeAds(rawAds: any[], productName: string, queryData: any): Promise<IntelligenceResult> {
    const base: IntelligenceResult = {
      queries: queryData.queries,
      productCategory: queryData.productCategory,
      mainKeywords: queryData.mainKeywords,
      ads: [],
      overallInsights: [],
      dominantAngle: 'N/A',
      totalFound: 0,
    };

    if (rawAds.length === 0) {
      base.overallInsights = ['No se encontraron anuncios activos para este producto. Intenta con otro término o país.'];
      return base;
    }

    const normalized = rawAds.map(ad => ({
      id: ad.id,
      copy: ((ad.ad_creative_bodies ?? [])[0] ?? '').slice(0, 400),
      title: (ad.ad_creative_link_titles ?? [])[0] ?? '',
      caption: (ad.ad_creative_link_captions ?? [])[0] ?? '',
      pageName: ad.page_name ?? 'Desconocido',
      pageId: ad.page_id ?? '',
      startDate: (ad.ad_delivery_start_time ?? '').split(/[·\|]/)[0].trim(),
      daysActive: (() => {
        const raw = (ad.ad_delivery_start_time ?? '').split(/[·\|]/)[0].trim();
        if (!raw) return 0;
        const ms = Date.now() - new Date(raw).getTime();
        return isNaN(ms) ? 0 : Math.max(0, Math.floor(ms / 86400000));
      })(),
      snapshotUrl: ad.ad_snapshot_url ?? '',
      platforms: ad.publisher_platforms ?? [],
      angle: 'N/A',
      insights: [] as string[],
    }));

    try {
      const prompt = `Analiza ${normalized.length} anuncios activos del producto "${productName}" en Meta Ads.

${JSON.stringify(normalized.map(a => ({ id: a.id, copy: a.copy, title: a.title, pageName: a.pageName, daysActive: a.daysActive })))}

Responde SOLO JSON válido sin markdown:
{
  "ads": [{"id":"...","angle":"Problema→Solución|Curiosidad|Demostración|Transformación|Prueba Social|Oferta Directa","insights":["insight corto"]}],
  "relevantIds": ["id1","id2"],
  "overallInsights": ["insight general 1","insight general 2","insight general 3"],
  "dominantAngle": "el ángulo más frecuente"
}

Reglas:
- relevantIds: solo los anuncios realmente relacionados con "${productName}"
- Insights: concisos, accionables, en español (ej: "Lleva 45 días activo — producto validado")
- overallInsights: patrones clave del mercado`;

      const res = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = (res.content[0] as Anthropic.Messages.TextBlock).text
        .replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
      const ai = JSON.parse(raw);

      // Only filter if Claude returned at least one relevant ID; empty array = keep everything
      const relevantIds: string[] = ai.relevantIds ?? [];
      const relevantSet = new Set<string>(relevantIds.length > 0 ? relevantIds : normalized.map(a => a.id));
      const analysisMap = new Map((ai.ads ?? []).map((a: any) => [a.id, a]));

      const finalAds = normalized
        .filter(a => relevantSet.has(a.id))
        .sort((a, b) => b.daysActive - a.daysActive)
        .map(a => ({
          ...a,
          angle: (analysisMap.get(a.id) as any)?.angle ?? 'N/A',
          insights: (analysisMap.get(a.id) as any)?.insights ?? [],
        }));

      return {
        ...base,
        ads: finalAds,
        overallInsights: ai.overallInsights ?? [],
        dominantAngle: ai.dominantAngle ?? 'N/A',
        totalFound: finalAds.length,
      };
    } catch (e: any) {
      this.logger.error(`Claude analysis error: ${e.message}`);
      return {
        ...base,
        ads: normalized.sort((a, b) => b.daysActive - a.daysActive),
        totalFound: normalized.length,
      };
    }
  }
}
