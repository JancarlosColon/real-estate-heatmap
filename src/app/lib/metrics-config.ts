import { TimePeriodConfig, TimePeriod, MetricConfig, MetricKey } from '../types';

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

// ─── Metric Definitions ─────────────────────────────────────────

export const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  heat_index: {
    key: 'heat_index',
    label: 'Market Heat Index',
    shortLabel: 'Heat Index',
    format: 'index',
    colorScale: 'heat',
    description: 'Market temperature from cool (buyer\'s) to hot (seller\'s)',
  },
  zhvi: {
    key: 'zhvi',
    label: 'Home Value (ZHVI)',
    shortLabel: 'Home Value',
    format: 'currency',
    colorScale: 'price',
    description: 'Zillow Home Value Index — typical home value',
  },
  zori: {
    key: 'zori',
    label: 'Rent Index (ZORI)',
    shortLabel: 'Rent',
    format: 'currency',
    colorScale: 'price',
    description: 'Zillow Observed Rent Index — typical monthly rent',
  },
  sale_to_list: {
    key: 'sale_to_list',
    label: 'Sale-to-List Ratio',
    shortLabel: 'Sale/List',
    format: 'ratio',
    colorScale: 'heat',
    description: 'Ratio of sale price to list price (>1 = over asking)',
  },
  median_list_price: {
    key: 'median_list_price',
    label: 'Median List Price',
    shortLabel: 'List Price',
    format: 'currency',
    colorScale: 'price',
    description: 'Median listing price for homes on the market',
  },
  median_sale_price: {
    key: 'median_sale_price',
    label: 'Median Sale Price',
    shortLabel: 'Sale Price',
    format: 'currency',
    colorScale: 'price',
    description: 'Median sale price of recently sold homes',
  },
  price_cuts: {
    key: 'price_cuts',
    label: 'Price Cuts',
    shortLabel: 'Price Cuts',
    format: 'percent',
    colorScale: 'percent',
    description: 'Percentage of listings with a price reduction',
  },
  new_listings: {
    key: 'new_listings',
    label: 'New Listings',
    shortLabel: 'New Listings',
    format: 'count',
    colorScale: 'inventory',
    description: 'Number of new listings added this period',
  },
  inventory: {
    key: 'inventory',
    label: 'Active Inventory',
    shortLabel: 'Inventory',
    format: 'count',
    colorScale: 'inventory',
    description: 'Total number of active for-sale listings',
  },
};

export const METRIC_KEYS = Object.keys(METRIC_CONFIGS) as MetricKey[];

// Format a metric value for display
export function formatMetricValue(value: number | null, format: MetricConfig['format']): string {
  if (value === null || value === undefined) return 'N/A';
  switch (format) {
    case 'currency':
      return value >= 1000000
        ? `$${(value / 1000000).toFixed(1)}M`
        : value >= 1000
          ? `$${(value / 1000).toFixed(0)}K`
          : `$${value.toFixed(0)}`;
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    case 'ratio':
      return value.toFixed(3);
    case 'count':
      return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toFixed(0);
    case 'index':
    default:
      return Math.round(value).toString();
  }
}

// Get color for any metric value
export function getMetricColor(value: number, metricKey: MetricKey): string {
  const config = METRIC_CONFIGS[metricKey];
  switch (config.colorScale) {
    case 'heat':
      return getHeatColor(value);
    case 'price': {
      // Blue (low) → Purple (mid) → Red (high) for price metrics
      // Normalize based on rough US ranges
      const ranges: Record<string, [number, number]> = {
        zhvi: [100000, 800000],
        zori: [800, 3000],
        median_list_price: [100000, 1000000],
        median_sale_price: [100000, 800000],
      };
      const [min, max] = ranges[metricKey] || [0, 1000000];
      const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
      const priceColors = ['#93c5fd', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#ef4444'];
      return priceColors[Math.floor(norm * (priceColors.length - 1))];
    }
    case 'percent': {
      // Green (low cuts) → Yellow → Red (many cuts)
      const norm = Math.max(0, Math.min(1, value / 0.4)); // 0-40% range
      const cutColors = ['#4ade80', '#a3e635', '#facc15', '#fb923c', '#f87171', '#ef4444', '#dc2626', '#b91c1c'];
      return cutColors[Math.floor(norm * (cutColors.length - 1))];
    }
    case 'inventory': {
      // Teal (low) → Blue (mid) → Purple (high)
      const norm = Math.max(0, Math.min(1, value / 2000));
      const invColors = ['#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a', '#042f2e'];
      return invColors[Math.floor(norm * (invColors.length - 1))];
    }
    default:
      return getHeatColor(value);
  }
}
