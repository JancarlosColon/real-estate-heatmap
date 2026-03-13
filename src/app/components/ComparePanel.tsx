'use client';

import { useState } from 'react';
import { CountyMetric, ZipMetric, MetricKey } from '../types';
import { METRIC_CONFIGS, formatMetricValue, getMetricColor, getHeatColor } from '../lib/metrics-config';

interface ComparePanelProps {
  items: (CountyMetric | ZipMetric)[];
  metric: MetricKey;
  onRemove: (id: string) => void;
  onClose: () => void;
}

function getId(item: CountyMetric | ZipMetric): string {
  return 'fips' in item ? item.fips : (item as ZipMetric).zip_code;
}

function getName(item: CountyMetric | ZipMetric): string {
  if ('fips' in item) return (item as CountyMetric).county_name.replace(' County', '');
  return `${(item as ZipMetric).zip_code} ${(item as ZipMetric).city || ''}`.trim();
}

export default function ComparePanel({ items, metric, onRemove, onClose }: ComparePanelProps) {
  if (items.length < 2) return null;

  const config = METRIC_CONFIGS[metric];
  const values = items.map((item) => item.heat_index);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);

  return (
    <div className="absolute bottom-0 left-0 right-0 md:bottom-8 md:right-8 md:left-auto bg-black/80 backdrop-blur-xl rounded-t-2xl md:rounded-2xl p-4 md:p-5 md:w-96 border border-white/10 z-30">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white text-sm font-medium">Compare ({items.length})</h3>
        <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors p-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const id = getId(item);
          const name = getName(item);
          const val = item.heat_index;
          const barWidth = maxVal > minVal ? ((val - minVal) / (maxVal - minVal)) * 100 : 50;
          const color = metric === 'heat_index' ? getHeatColor(val) : getMetricColor(val, metric);

          return (
            <div key={id} className="relative">
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-300 text-xs truncate pr-2">{name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color }}>
                    {formatMetricValue(val, config.format)}
                  </span>
                  <button
                    onClick={() => onRemove(id)}
                    className="text-gray-700 hover:text-gray-400 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, barWidth)}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {maxVal !== minVal && (
        <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-gray-600">
          Difference: {formatMetricValue(maxVal - minVal, config.format)}
        </div>
      )}
    </div>
  );
}
