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

// Color gradient from light red (cool) to dark red (hot)
export const heatColors = [
  '#fecaca', // lightest red
  '#fca5a5',
  '#f87171',
  '#ef4444',
  '#dc2626',
  '#b91c1c',
  '#991b1b',
  '#7f1d1d', // darkest red
];
