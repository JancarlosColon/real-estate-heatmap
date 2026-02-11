'use client';

import { TimePeriod } from '../types';
import { timePeriodsConfig } from '../lib/metrics-config';

interface TimePeriodSelectorProps {
  selectedPeriod: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
}

export default function TimePeriodSelector({ selectedPeriod, onPeriodChange }: TimePeriodSelectorProps) {
  const periods = Object.values(timePeriodsConfig);

  return (
    <div className="flex flex-wrap gap-2">
      {periods.map((period) => (
        <button
          key={period.key}
          onClick={() => onPeriodChange(period.key)}
          className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide transition-all duration-200 ${
            selectedPeriod === period.key
              ? 'bg-white text-black'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
