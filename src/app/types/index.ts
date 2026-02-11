export interface MetroMetric {
  name: string;
  heat_index: number;
  sizeRank: number;
}

export interface StateMetric {
  state_code: string;
  state_name: string;
  heat_index: number;
  metro_count: number;
  metros: MetroMetric[];
}

export type TimePeriod = '30d' | '90d' | '6m' | '1y' | '3y' | '5y';

export interface TimePeriodConfig {
  key: TimePeriod;
  label: string;
}
