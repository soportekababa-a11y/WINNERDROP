import { Injectable, Logger } from '@nestjs/common';
import { MetaAdsProvider } from './providers/meta-ads.provider';
import { MARKETS, DEFAULT_MARKET } from './config/markets.config';
import { PLATFORMS, DEFAULT_PLATFORM } from './config/platforms.config';
import { RawAd, SpyResult, CompetitorSummary, AdFormat } from './dto/spy-result.dto';
import { analyzeSaturation } from './analyzers/saturation.analyzer';
import { detectDominantCreativeType, detectFormatWinner, detectCreativeFatigue } from './analyzers/creative.analyzer';
import { calculateOpportunityScore, getOpportunityLabel } from './analyzers/opportunity.analyzer';

const STOPWORDS = new Set([
  'y', 'de', 'el', 'la', 'los', 'las', 'para', 'con', 'una', 'un', 'por', 'sin', 'en', 'a', 'o',
  'del', 'al', 'se', 'su', 'sus', 'es', 'le', 'lo', 'mi', 'me', 'que', 'no', 'si', 'más', 'muy',
]);

const UNIT_PATTERN = /\b\d+\s*(mg|ml|g|gr|kg|cm|mm|oz|lb|unidades?|piezas?|pack|kit)\b/gi;
const NUMBER_PATTERN = /\b\d+\b/g;

@Injectable()
export class CompetitorSpyService {
  private readonly logger = new Logger(CompetitorSpyService.name);

  constructor(private readonly metaAdsProvider: MetaAdsProvider) {}

  async analyzeProduct(
    productName: string,
    marketCode = DEFAULT_MARKET,
    platformId = DEFAULT_PLATFORM,
  ): Promise<SpyResult> {
    const market = MARKETS[marketCode] ?? MARKETS[DEFAULT_MARKET];
    const platform = PLATFORMS[platformId] ?? PLATFORMS[DEFAULT_PLATFORM];

    const queries = this.generateSearchQueries(productName);
    this.logger.log(`Analyzing "${productName}" | Market: ${market.code} | Queries: ${queries.join(', ')}`);

    // Scrape each query and aggregate (deduplicate by advertiser name)
    const allAds: RawAd[] = [];
    const seenAdvertisers = new Set<string>();

    for (const query of queries) {
      const ads = await this.metaAdsProvider.scrape(query, platform, market.metaCountryCode);
      for (const ad of ads) {
        const key = ad.advertiserName.toLowerCase().trim();
        if (!seenAdvertisers.has(key)) {
          seenAdvertisers.add(key);
          allAds.push(ad);
        } else {
          // Update existing if this one has more days active
          const existing = allAds.find(a => a.advertiserName.toLowerCase().trim() === key);
          if (existing && ad.daysActive > existing.daysActive) {
            existing.daysActive = ad.daysActive;
            existing.format = ad.format;
          }
        }
      }
      // Delay between queries to avoid rate limiting
      if (queries.indexOf(query) < queries.length - 1) {
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    this.logger.log(`Total unique ads: ${allAds.length}`);

    // Build competitor summaries
    const competitorMap = new Map<string, { ads: RawAd[] }>();
    for (const ad of allAds) {
      const key = ad.advertiserName.toLowerCase().trim();
      if (!competitorMap.has(key)) competitorMap.set(key, { ads: [] });
      competitorMap.get(key)!.ads.push(ad);
    }

    const competitors: CompetitorSummary[] = [...competitorMap.entries()].map(([, { ads }]) => {
      const maxDaysActive = Math.max(...ads.map(a => a.daysActive));
      const formats = [...new Set(ads.map(a => a.format))];
      const dominantFormat = ads.filter(a => a.format === 'video').length >= ads.length / 2 ? 'video' : 'image';
      const platforms = [...new Set(ads.flatMap(a => a.platforms))];
      return {
        name: ads[0].advertiserName,
        pageUrl: ads[0].pageUrl,
        totalAds: ads.length,
        maxDaysActive,
        dominantFormat: dominantFormat as AdFormat,
        platforms,
      };
    }).sort((a, b) => b.maxDaysActive - a.maxDaysActive);

    const avgDaysActive = allAds.length > 0
      ? allAds.reduce((s, a) => s + a.daysActive, 0) / allAds.length
      : 0;

    // Run analyzers
    const saturation = analyzeSaturation(allAds, competitors.length);
    const formatWinner = detectFormatWinner(allAds);
    const dominantCreativeType = detectDominantCreativeType(allAds);
    const creativeFatigue = detectCreativeFatigue(allAds);
    const opportunityScore = calculateOpportunityScore(saturation.score, competitors.length, avgDaysActive);
    const { emoji: opportunityEmoji, label: opportunityLabel } = getOpportunityLabel(opportunityScore);

    // Dominant competitor insight
    const dominantCompetitor = competitors.length > 0
      ? {
          ...competitors[0],
          insight: `Activo hace ${competitors[0].maxDaysActive} días usando ${competitors[0].dominantFormat === 'video' ? 'videos' : 'imágenes'}`,
        }
      : null;

    return {
      productName,
      market: market.name,
      marketFlag: market.flag,
      platform: platform.name,
      scrapedAt: new Date().toISOString(),
      searchQueries: queries,
      totalAdsFound: allAds.length,
      competitors: competitors.slice(0, 20),
      saturation,
      dominantCompetitor,
      formatWinner,
      dominantCreativeType,
      creativeFatigue,
      opportunityScore,
      opportunityEmoji,
      opportunityLabel,
    };
  }

  private generateSearchQueries(productName: string): string[] {
    // Clean the product name
    const cleaned = productName
      .toLowerCase()
      .replace(UNIT_PATTERN, '')
      .replace(/[()\/\[\]]/g, ' ')
      .replace(NUMBER_PATTERN, '')
      .replace(/\s+/g, ' ')
      .trim();

    const words = cleaned
      .split(' ')
      .map(w => w.trim())
      .filter(w => w.length > 2 && !STOPWORDS.has(w));

    const queries: string[] = [];

    // Query 1: first 3 meaningful words
    if (words.length > 0) {
      queries.push(words.slice(0, 3).join(' '));
    }

    // Query 2: first 2 words (broader)
    if (words.length >= 3) {
      const broad = words.slice(0, 2).join(' ');
      if (broad !== queries[0]) queries.push(broad);
    }

    // Query 3: last 2-3 unique words (product variant)
    if (words.length >= 4) {
      const variant = words.slice(-2).join(' ');
      if (!queries.includes(variant)) queries.push(variant);
    }

    return queries.slice(0, 3).filter(Boolean);
  }
}
