'use client';

import { useRef } from 'react';
import type { DrillDownState, MetricKey, TimePeriod } from '@/app/types';

const STATE_NAMES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia',
};

const VALID_PERIODS: TimePeriod[] = ['30d', '90d', '6m', '1y', '3y', '5y'];
const VALID_METRICS: MetricKey[] = [
  'heat_index', 'zhvi', 'zori', 'sale_to_list', 'median_list_price',
  'median_sale_price', 'price_cuts', 'new_listings', 'inventory',
];

function parseUrlState(): {
  initialMetric: MetricKey | null;
  initialPeriod: TimePeriod | null;
  initialDrillDown: DrillDownState | null;
} {
  if (typeof window === 'undefined') {
    return { initialMetric: null, initialPeriod: null, initialDrillDown: null };
  }

  const params = new URLSearchParams(window.location.search);

  const metricParam = params.get('metric');
  const initialMetric = metricParam && VALID_METRICS.includes(metricParam as MetricKey)
    ? (metricParam as MetricKey)
    : null;

  const periodParam = params.get('period');
  const initialPeriod = periodParam && VALID_PERIODS.includes(periodParam as TimePeriod)
    ? (periodParam as TimePeriod)
    : null;

  const stateCode = params.get('state')?.toUpperCase() ?? null;
  const countyName = params.get('county') ?? null;
  const countyFips = params.get('fips') ?? null;

  let initialDrillDown: DrillDownState | null = null;

  if (stateCode && STATE_NAMES[stateCode]) {
    if (countyName && countyFips) {
      initialDrillDown = {
        level: 'county',
        stateCode,
        stateName: STATE_NAMES[stateCode],
        countyName,
        countyFips,
      };
    } else {
      initialDrillDown = {
        level: 'county',
        stateCode,
        stateName: STATE_NAMES[stateCode],
      };
    }
  }

  return { initialMetric, initialPeriod, initialDrillDown };
}

export function syncToUrl(
  drillDown: DrillDownState | null,
  metric: MetricKey,
  period: TimePeriod,
): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams();

  if (drillDown?.stateCode) {
    params.set('state', drillDown.stateCode);
    if (drillDown.countyName) params.set('county', drillDown.countyName);
    if (drillDown.countyFips) params.set('fips', drillDown.countyFips);
  }

  if (metric !== 'heat_index') params.set('metric', metric);
  if (period !== '30d') params.set('period', period);

  const search = params.toString();
  const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

export function useUrlState() {
  const parsed = useRef(parseUrlState());
  return parsed.current;
}
