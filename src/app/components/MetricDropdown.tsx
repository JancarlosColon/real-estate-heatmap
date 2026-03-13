'use client';

import { useState, useRef, useEffect } from 'react';
import { MetricKey } from '../types';
import { METRIC_CONFIGS, METRIC_KEYS } from '../lib/metrics-config';

interface MetricDropdownProps {
  selectedMetric: MetricKey;
  onMetricChange: (metric: MetricKey) => void;
}

export default function MetricDropdown({ selectedMetric, onMetricChange }: MetricDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = METRIC_CONFIGS[selectedMetric];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 text-white text-sm hover:bg-white/15 transition-colors"
      >
        <span className="font-medium">{current.shortLabel}</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-64 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50">
          {METRIC_KEYS.map((key) => {
            const config = METRIC_CONFIGS[key];
            const isSelected = key === selectedMetric;
            return (
              <button
                key={key}
                onClick={() => {
                  onMetricChange(key);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 flex flex-col gap-0.5 transition-colors ${
                  isSelected
                    ? 'bg-white/15 text-white'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-sm font-medium">{config.label}</span>
                <span className="text-xs text-gray-500">{config.description}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
