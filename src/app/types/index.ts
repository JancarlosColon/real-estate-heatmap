// Geographic drill-down levels
export type GeoLevel = 'state' | 'county' | 'zip';

export interface MetroMetric {
  name: string;
  heat_index: number;
  sizeRank: number;
  change?: number;
}

export interface StateMetric {
  state_code: string;
  state_name: string;
  heat_index: number;
  metro_count: number;
  metros: MetroMetric[];
  change?: number;
}

export interface CountyMetric {
  fips: string; // 5-digit FIPS code (e.g., "06037")
  county_name: string;
  state_code: string;
  state_name: string;
  heat_index: number;
  metro?: string;
  change?: number;
}

export interface ZipMetric {
  zip_code: string;
  city: string;
  county_name: string;
  state_code: string;
  heat_index: number;
  lat: number;
  lng: number;
  change?: number;
}

export type TimePeriod = '30d' | '90d' | '6m' | '1y' | '3y' | '5y';

export interface TimePeriodConfig {
  key: TimePeriod;
  label: string;
}

// Metric types
export type MetricKey = 'heat_index' | 'zhvi' | 'zori' | 'sale_to_list' | 'median_list_price' | 'median_sale_price' | 'price_cuts' | 'new_listings' | 'inventory';

export interface MetricConfig {
  key: MetricKey;
  label: string;
  shortLabel: string;
  format: 'index' | 'currency' | 'percent' | 'ratio' | 'count';
  colorScale: 'heat' | 'price' | 'percent' | 'inventory';
  description: string;
}

// Navigation breadcrumb for drill-down
export interface DrillDownState {
  level: GeoLevel;
  stateName?: string;
  stateCode?: string;
  countyName?: string;
  countyFips?: string;
}
