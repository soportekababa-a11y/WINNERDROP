export interface PlatformConfig {
  id: string;
  name: string;
  enabled: boolean;
  buildSearchUrl: (keyword: string, countryCode: string) => string;
}

export const PLATFORMS: Record<string, PlatformConfig> = {
  META_ADS: {
    id: 'meta_ads',
    name: 'Meta Ads Library',
    enabled: true,
    buildSearchUrl: (keyword: string, countryCode: string) =>
      `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${countryCode}&q=${encodeURIComponent(keyword)}&search_type=keyword_unordered&media_type=all`,
  },
};

export const DEFAULT_PLATFORM = 'META_ADS';
