'use client';

import { MetricKey } from '../types';
import { heatColors, METRIC_CONFIGS } from '../lib/metrics-config';

const COLOR_SCALES: Record<string, { colors: string[]; low: string; high: string; lowDesc?: string; highDesc?: string }> = {
  heat: {
    colors: heatColors,
    low: 'Cool', high: 'Hot',
    lowDesc: 'favors buyers', highDesc: 'favors sellers',
  },
  price: {
    colors: ['#93c5fd', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#ef4444'],
    low: 'Low', high: 'High',
  },
  percent: {
    colors: ['#4ade80', '#a3e635', '#facc15', '#fb923c', '#f87171', '#ef4444', '#dc2626', '#b91c1c'],
    low: 'Low', high: 'High',
  },
  inventory: {
    colors: ['#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a', '#042f2e'],
    low: 'Low', high: 'High',
  },
};

interface LegendProps {
  selectedMetric: MetricKey;
}

export default function Legend({ selectedMetric }: LegendProps) {
  const config = METRIC_CONFIGS[selectedMetric];
  const scale = COLOR_SCALES[config.colorScale];

  return (
    <div className="bg-black/60 backdrop-blur-xl rounded-xl p-3 md:p-4 w-36 md:w-44 border border-white/10">
      <h3 className="text-white text-xs font-medium tracking-wide mb-2 md:mb-3">{config.label}</h3>

      <div
        className="h-2 rounded-full"
        style={{
          background: `linear-gradient(to right, ${scale.colors.join(', ')})`,
        }}
      />

      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-gray-500">{scale.low}</span>
        <span className="text-[10px] text-gray-500">{scale.high}</span>
      </div>

      {scale.lowDesc && scale.highDesc && (
        <div className="hidden md:block mt-2.5 pt-2.5 border-t border-white/5 text-[10px] text-gray-600 space-y-1">
          <div><span className="text-gray-400">{scale.low}</span> = {scale.lowDesc}</div>
          <div><span className="text-gray-400">{scale.high}</span> = {scale.highDesc}</div>
        </div>
      )}

      <div className="hidden md:block mt-2.5 pt-2.5 border-t border-white/5 text-[9px] text-gray-700 leading-relaxed">
        For informational purposes only. Not financial advice.
      </div>
    </div>
  );
}
