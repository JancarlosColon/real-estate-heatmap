'use client';

import { StateMetric } from '../types';
import { heatColors } from '../lib/metrics-config';

interface StateInfoPanelProps {
  state: StateMetric | null;
  onClose: () => void;
}

function getHeatLabel(index: number): string {
  if (index >= 80) return "Strong Seller's Market";
  if (index >= 60) return "Seller's Market";
  if (index >= 45) return 'Neutral';
  if (index >= 30) return "Buyer's Market";
  return "Strong Buyer's Market";
}

function getHeatColor(index: number): string {
  const min = 30;
  const max = 100;
  const normalized = Math.max(0, Math.min(1, (index - min) / (max - min)));
  const colorIndex = Math.floor(normalized * (heatColors.length - 1));
  return heatColors[colorIndex];
}

function ChangeIndicator({ change, currentValue }: { change?: number; currentValue: number }) {
  if (!change || change === 0) return null;
  const now = currentValue + change;
  return (
    <span className="text-xs ml-1.5">
      <span className="text-gray-500">→</span>{' '}
      <span className={change > 0 ? 'text-green-400' : 'text-red-400'}>{now} now</span>
    </span>
  );
}

export default function StateInfoPanel({ state, onClose }: StateInfoPanelProps) {
  if (!state) return null;

  return (
    <div className="absolute bottom-8 left-8 bg-black/80 backdrop-blur-xl rounded-2xl p-6 w-80 max-h-[70vh] overflow-y-auto border border-white/10">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="text-xl font-light text-white tracking-tight">{state.state_name}</h2>
          <p className="text-gray-600 text-xs tracking-wide mt-1">{state.state_code}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-white transition-colors p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* State Average */}
      <div className="mb-6">
        <div className="flex justify-between items-baseline">
          <span className="text-gray-500 text-xs tracking-wide">State Average</span>
          <span>
            <span className="text-2xl font-light" style={{ color: getHeatColor(state.heat_index) }}>
              {state.heat_index}
            </span>
            <ChangeIndicator change={state.change} currentValue={state.heat_index} />
          </span>
        </div>
        <div className="mt-1">
          <span className="text-sm" style={{ color: getHeatColor(state.heat_index) }}>
            {getHeatLabel(state.heat_index)}
          </span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-gradient-to-r from-red-200 to-red-900"
            style={{ width: `${Math.min(100, (state.heat_index / 100) * 100)}%` }}
          />
        </div>
      </div>

      {/* Metro Breakdown */}
      {state.metros && state.metros.length > 0 && (
        <div>
          <h3 className="text-gray-400 text-xs tracking-wide mb-3 uppercase">
            Metro Areas ({state.metro_count})
          </h3>
          <div className="space-y-2">
            {state.metros.map((metro, idx) => (
              <div key={idx} className="py-2 border-b border-white/5 last:border-0">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm truncate pr-2" title={metro.name}>
                    {metro.name.replace(`, ${state.state_code}`, '')}
                  </span>
                  <span>
                    <span className="text-sm font-medium" style={{ color: getHeatColor(metro.heat_index) }}>
                      {metro.heat_index}
                    </span>
                    <ChangeIndicator change={metro.change} currentValue={metro.heat_index} />
                  </span>
                </div>
                <span className="text-xs" style={{ color: getHeatColor(metro.heat_index) }}>
                  {getHeatLabel(metro.heat_index)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-white/5">
        <p className="text-gray-600 text-xs tracking-wide">
          Source: Zillow Market Heat Index
        </p>
      </div>
    </div>
  );
}
