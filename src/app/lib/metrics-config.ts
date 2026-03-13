import { TimePeriodConfig, TimePeriod } from '../types';

export const timePeriodsConfig: Record<TimePeriod, TimePeriodConfig> = {
  '30d': {
    key: '30d',
    label: '30 Days',
  },
  '90d': {
    key: '90d',
    label: '90 Days',
  },
  '6m': {
    key: '6m',
    label: '6 Months',
  },
  '1y': {
    key: '1y',
    label: '1 Year',
  },
  '3y': {
    key: '3y',
    label: '3 Years',
  },
  '5y': {
    key: '5y',
    label: '5 Years',
  },
};

// Color gradient from cool (buyer's market) to hot (seller's market)
export const heatColors = [
  '#fecaca', // lightest red - cool
  '#fca5a5',
  '#f87171',
  '#ef4444',
  '#dc2626',
  '#b91c1c',
  '#991b1b',
  '#7f1d1d', // darkest red - hot
];

// Get color for a heat index value (30-100 range)
export function getHeatColor(index: number): string {
  const min = 30;
  const max = 100;
  const normalized = Math.max(0, Math.min(1, (index - min) / (max - min)));
  const colorIndex = Math.floor(normalized * (heatColors.length - 1));
  return heatColors[colorIndex];
}

// Get market label for a heat index value
export function getHeatLabel(index: number): string {
  if (index >= 80) return "Strong Seller's Market";
  if (index >= 60) return "Seller's Market";
  if (index >= 45) return 'Neutral';
  if (index >= 30) return "Buyer's Market";
  return "Strong Buyer's Market";
}

// Zillow CDN base URL for public research CSVs
export const ZILLOW_CDN_BASE = 'https://files.zillowstatic.com/research/public_csvs';

// Data source URLs
export const DATA_SOURCES = {
  metro_heat: `${ZILLOW_CDN_BASE}/market_temp_index/Metro_market_temp_index_uc_sfrcondo_month.csv`,
  county_heat: `${ZILLOW_CDN_BASE}/market_temp_index/County_market_temp_index_uc_sfrcondo_month.csv`,
  zip_heat: `${ZILLOW_CDN_BASE}/market_temp_index/Zip_market_temp_index_uc_sfrcondo_month.csv`,
} as const;

// GeoJSON sources
export const GEO_SOURCES = {
  states: 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json',
  counties: 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json',
  zip_centroids: 'https://gist.githubusercontent.com/erichurst/7882666/raw/5bdc46db47d9515269ab12ed6fb2850377fd869e/US%20Zip%20Codes%20from%202013%20Government%20Data',
} as const;

// Period offset mapping (months back from latest date)
export const periodOffsets: Record<string, number> = {
  '30d': 0,
  '90d': 2,
  '6m': 5,
  '1y': 11,
  '3y': 35,
  '5y': 59,
};
