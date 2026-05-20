export type SaturationLevel = 'low' | 'medium' | 'high';
export type CreativeType = 'ugc' | 'problem_solution' | 'lifestyle' | 'offer' | 'demo' | 'before_after' | 'unknown';
export type FatigueLevel = 'low' | 'medium' | 'high';
export type AdFormat = 'video' | 'image' | 'carousel' | 'unknown';

export interface RawAd {
  advertiserName: string;
  pageUrl: string | null;
  format: AdFormat;
  platforms: string[];
  startDateRaw: string | null;
  daysActive: number;
  adCopy: string;
}

export interface CompetitorSummary {
  name: string;
  pageUrl: string | null;
  totalAds: number;
  maxDaysActive: number;
  dominantFormat: AdFormat;
  platforms: string[];
}

export interface SpyResult {
  productName: string;
  market: string;
  marketFlag: string;
  platform: string;
  scrapedAt: string;
  searchQueries: string[];
  totalAdsFound: number;
  competitors: CompetitorSummary[];

  saturation: {
    level: SaturationLevel;
    score: number;
    emoji: string;
    label: string;
  };

  dominantCompetitor: (CompetitorSummary & { insight: string }) | null;

  formatWinner: {
    format: AdFormat;
    videoCount: number;
    imageCount: number;
    percentage: number;
    label: string;
    emoji: string;
  };

  dominantCreativeType: {
    type: CreativeType;
    label: string;
    emoji: string;
    percentage: number;
  };

  creativeFatigue: {
    level: FatigueLevel;
    label: string;
    emoji: string;
  };

  opportunityScore: number;
  opportunityEmoji: string;
  opportunityLabel: string;
}
