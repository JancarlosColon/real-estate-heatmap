'use client';

import { heatColors } from '../lib/metrics-config';

export default function Legend() {
  return (
    <div className="bg-black/60 backdrop-blur-xl rounded-xl p-3 md:p-4 w-36 md:w-44 border border-white/10">
      <h3 className="text-white text-xs font-medium tracking-wide mb-2 md:mb-3">Market Heat Index</h3>

      <div
        className="h-2 rounded-full"
        style={{
          background: `linear-gradient(to right, ${heatColors.join(', ')})`,
        }}
      />

      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-gray-500">Cool</span>
        <span className="text-[10px] text-gray-500">Hot</span>
      </div>

      <div className="hidden md:block mt-2.5 pt-2.5 border-t border-white/5 text-[10px] text-gray-600 space-y-1">
        <div><span className="text-gray-400">Cool</span> = favors buyers</div>
        <div><span className="text-gray-400">Hot</span> = favors sellers</div>
      </div>

      <div className="hidden md:block mt-2.5 pt-2.5 border-t border-white/5 text-[9px] text-gray-700 leading-relaxed">
        For informational purposes only. Not financial advice.
      </div>
    </div>
  );
}
