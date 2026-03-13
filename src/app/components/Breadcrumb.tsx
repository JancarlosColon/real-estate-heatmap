'use client';

import { DrillDownState } from '../types';

interface BreadcrumbProps {
  drillDown: DrillDownState;
  onGoBack: () => void;
  onReset: () => void;
  loading: boolean;
}

export default function Breadcrumb({ drillDown, onGoBack, onReset, loading }: BreadcrumbProps) {
  if (drillDown.level === 'state') return null;

  return (
    <div className="absolute top-14 md:top-20 left-4 md:left-8 flex items-center gap-2 z-10">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 tracking-wide px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
        <button
          onClick={onReset}
          className="hover:text-white transition-colors cursor-pointer"
        >
          US
        </button>
        {drillDown.stateName && (
          <>
            <span className="text-gray-700">/</span>
            <button
              onClick={drillDown.level === 'zip' ? onGoBack : undefined}
              className={`${
                drillDown.level === 'zip'
                  ? 'hover:text-white cursor-pointer'
                  : 'text-gray-300'
              } transition-colors`}
            >
              {drillDown.stateName}
            </button>
          </>
        )}
        {drillDown.countyName && (
          <>
            <span className="text-gray-700">/</span>
            <span className="text-gray-300">{drillDown.countyName.replace(' County', '')}</span>
          </>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
          <span className="text-[10px] text-gray-600 tracking-wider uppercase">Loading</span>
        </div>
      )}
    </div>
  );
}
