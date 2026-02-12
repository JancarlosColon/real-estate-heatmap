'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { StateMetric, TimePeriod } from './types';
import TimePeriodSelector from './components/MetricSelector';
import StateInfoPanel from './components/StateInfoPanel';
import Legend from './components/Legend';

const Globe = dynamic(() => import('./components/Globe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="text-gray-500 text-lg font-light tracking-wide">Loading map...</div>
    </div>
  ),
});

export default function Home() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30d');
  const [selectedState, setSelectedState] = useState<StateMetric | null>(null);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <Globe
        selectedPeriod={selectedPeriod}
        selectedState={selectedState}
        onStateSelect={setSelectedState}
      />

      <div className="absolute top-0 left-0 right-0 h-32 md:h-48 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

      <div className="absolute top-4 left-4 md:top-8 md:left-8 pointer-events-none">
        <h1 className="text-2xl md:text-4xl font-light text-white tracking-tight mb-1">
          Real Estate Heatmap
        </h1>
        <p className="text-gray-500 text-sm font-light tracking-wide hidden sm:block">
          US Market Conditions
        </p>
      </div>

      <div className="absolute top-14 md:top-8 left-4 right-4 md:left-0 md:right-0 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <TimePeriodSelector
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />
        </div>
      </div>

      <div className="absolute bottom-4 right-4 md:bottom-8 md:right-8">
        <Legend />
      </div>

      <StateInfoPanel
        state={selectedState}
        onClose={() => setSelectedState(null)}
      />

      {!selectedState && (
        <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8 text-gray-600 text-xs font-light tracking-wide hidden sm:block">
          <p>Drag to rotate · Scroll to zoom · Click state for details</p>
        </div>
      )}
      {!selectedState && (
        <div className="absolute bottom-4 left-4 text-gray-600 text-xs font-light tracking-wide sm:hidden">
          <p>Tap a state for details</p>
        </div>
      )}
    </div>
  );
}
