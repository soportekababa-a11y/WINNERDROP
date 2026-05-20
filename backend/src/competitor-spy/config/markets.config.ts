export interface MarketConfig {
  code: string;
  name: string;
  flag: string;
  metaCountryCode: string;
  currency: string;
  language: string;
}

export const MARKETS: Record<string, MarketConfig> = {
  RD: {
    code: 'RD',
    name: 'República Dominicana',
    flag: '🇩🇴',
    metaCountryCode: 'DO',
    currency: 'DOP',
    language: 'es',
  },
};

export const DEFAULT_MARKET = 'RD';
