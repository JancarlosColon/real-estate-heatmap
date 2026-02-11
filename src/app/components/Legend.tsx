'use client';

import { heatColors } from '../lib/metrics-config';

export default function Legend() {
  return (
    <div className="bg-black/60 backdrop-blur-xl rounded-xl p-4 w-44 border border-white/10">
      <h3 className="text-white text-xs font-medium tracking-wide mb-3">Market Heat Index</h3>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Buyer</span>
        <div
          className="flex-1 h-2 rounded-full"
          style={{
            background: `linear-gradient(to right, ${heatColors.join(', ')})`,
          }}
        />
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Seller</span>
      </div>

      <div className="flex justify-between mt-2">
        <span className="text-[10px] text-gray-600">30</span>
        <span className="text-[10px] text-gray-600">100+</span>
      </div>

      <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-gray-600">
        Higher = seller&apos;s market
      </div>
    </div>
  );
}
