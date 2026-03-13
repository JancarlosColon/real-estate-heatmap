'use client';

import { useState, useEffect } from 'react';
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

export interface UrlState {
  metric: MetricKey | null;
  period: TimePeriod | null;
  drillDown: DrillDownState | null;
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

/**
 * Reads URL params AFTER hydration to avoid SSR/client mismatch.
 * Returns callbacks that page.tsx uses to update state once.
 */
export function useUrlState(
  setMetric: (m: MetricKey) => void,
  setPeriod: (p: TimePeriod) => void,
  drillToCounty: (stateCode: string, stateName: string) => void,
  drillToZip: (countyName: string, countyFips: string, stateCode: string, stateName: string) => void,
) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const metricParam = params.get('metric');
    if (metricParam && VALID_METRICS.includes(metricParam as MetricKey)) {
      setMetric(metricParam as MetricKey);
    }

    const periodParam = params.get('period');
    if (periodParam && VALID_PERIODS.includes(periodParam as TimePeriod)) {
      setPeriod(periodParam as TimePeriod);
    }

    const stateCode = params.get('state')?.toUpperCase() ?? null;
    const countyName = params.get('county') ?? null;
    const countyFips = params.get('fips') ?? null;

    if (stateCode && STATE_NAMES[stateCode]) {
      if (countyName && countyFips) {
        drillToCounty(stateCode, STATE_NAMES[stateCode]);
        // Small delay so county data starts loading first
        setTimeout(() => drillToZip(countyName, countyFips, stateCode, STATE_NAMES[stateCode]), 50);
      } else {
        drillToCounty(stateCode, STATE_NAMES[stateCode]);
      }
    }

    setReady(true);
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}
