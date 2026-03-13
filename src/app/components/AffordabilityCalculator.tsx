'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { ZipMetric, CountyMetric, MetricKey } from '../types';
import { formatMetricValue } from '../lib/metrics-config';

interface AffordabilityCalcProps {
  counties: CountyMetric[];
  zips: ZipMetric[];
  selectedMetric: MetricKey;
  level: 'state' | 'county' | 'zip';
}

function calcMonthlyPayment(homePrice: number, downPct: number, rate: number, years: number): number {
  const principal = homePrice * (1 - downPct / 100);
  const monthlyRate = rate / 100 / 12;
  const n = years * 12;
  if (monthlyRate === 0) return principal / n;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
}

function calcMaxHome(salary: number, downPct: number, rate: number, years: number, dtiRatio: number): number {
  const maxMonthly = (salary / 12) * dtiRatio;
  const monthlyRate = rate / 100 / 12;
  const n = years * 12;
  if (monthlyRate === 0) return maxMonthly * n / (1 - downPct / 100);
  const principal = (maxMonthly * (Math.pow(1 + monthlyRate, n) - 1)) / (monthlyRate * Math.pow(1 + monthlyRate, n));
  return principal / (1 - downPct / 100);
}

export default function AffordabilityCalculator({ counties, zips, selectedMetric, level }: AffordabilityCalcProps) {
  const [open, setOpen] = useState(false);
  const [salary, setSalary] = useState(100000);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(6.5);
  const [active, setActive] = useState(false); // whether affordability overlay is on
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const maxHome = useMemo(() => calcMaxHome(salary, downPct, rate, 30, 0.28), [salary, downPct, rate]);
  const monthlyPayment = useMemo(() => calcMonthlyPayment(maxHome, downPct, rate, 30), [maxHome, downPct, rate]);

  // Compute affordability stats from visible data
  const stats = useMemo(() => {
    if (selectedMetric !== 'zhvi' && selectedMetric !== 'median_list_price' && selectedMetric !== 'median_sale_price') {
      return null;
    }

    const items = level === 'zip' ? zips : level === 'county' ? counties : [];
    if (items.length === 0) return null;

    const affordable = items.filter((i) => i.heat_index <= maxHome);
    const stretch = items.filter((i) => i.heat_index > maxHome && i.heat_index <= maxHome * 1.2);
    const outOfReach = items.filter((i) => i.heat_index > maxHome * 1.2);

    return {
      total: items.length,
      affordable: affordable.length,
      stretch: stretch.length,
      outOfReach: outOfReach.length,
      cheapest: items.length > 0 ? Math.min(...items.map((i) => i.heat_index)) : 0,
      median: items.length > 0 ? items.map((i) => i.heat_index).sort((a, b) => a - b)[Math.floor(items.length / 2)] : 0,
    };
  }, [counties, zips, level, selectedMetric, maxHome]);

  const isPriceMetric = selectedMetric === 'zhvi' || selectedMetric === 'median_list_price' || selectedMetric === 'median_sale_price';

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`bg-black/60 backdrop-blur-xl rounded-full p-2 border transition-colors ${
          active ? 'border-green-500/50 bg-green-500/10' : 'border-white/10 hover:bg-white/10'
        }`}
        title="Affordability calculator"
      >
        <svg className={`w-4 h-4 ${active ? 'text-green-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 p-4 animate-fade-in z-50">
          <h3 className="text-white text-sm font-medium mb-4">Affordability Calculator</h3>

          {/* Salary */}
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <label className="text-gray-500 text-xs">Annual Income</label>
              <span className="text-white text-xs font-mono">${salary.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={30000}
              max={500000}
              step={5000}
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>

          {/* Down Payment */}
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <label className="text-gray-500 text-xs">Down Payment</label>
              <span className="text-white text-xs font-mono">{downPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={downPct}
              onChange={(e) => setDownPct(Number(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>

          {/* Interest Rate */}
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <label className="text-gray-500 text-xs">Interest Rate</label>
              <span className="text-white text-xs font-mono">{rate}%</span>
            </div>
            <input
              type="range"
              min={2}
              max={10}
              step={0.25}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>

          {/* Results */}
          <div className="border-t border-white/10 pt-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs">Max Home Price</span>
              <span className="text-green-400 text-sm font-medium">{formatMetricValue(Math.round(maxHome), 'currency')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs">Monthly Payment</span>
              <span className="text-white text-xs font-mono">${Math.round(monthlyPayment).toLocaleString()}/mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs">Down Payment</span>
              <span className="text-white text-xs font-mono">{formatMetricValue(Math.round(maxHome * downPct / 100), 'currency')}</span>
            </div>
          </div>

          {/* Affordability breakdown when viewing price metrics at county/ZIP level */}
          {stats && isPriceMetric && (
            <div className="border-t border-white/10 pt-3 mt-3">
              <div className="text-gray-400 text-[10px] uppercase tracking-wide mb-2">
                {level === 'zip' ? 'ZIP Codes' : 'Counties'} in view
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-green-400 text-lg font-light">{stats.affordable}</div>
                  <div className="text-gray-600 text-[10px]">Affordable</div>
                </div>
                <div>
                  <div className="text-yellow-400 text-lg font-light">{stats.stretch}</div>
                  <div className="text-gray-600 text-[10px]">Stretch</div>
                </div>
                <div>
                  <div className="text-red-400 text-lg font-light">{stats.outOfReach}</div>
                  <div className="text-gray-600 text-[10px]">Out of reach</div>
                </div>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-white/5">
                <span className="text-gray-600 text-[10px]">Cheapest: {formatMetricValue(stats.cheapest, 'currency')}</span>
                <span className="text-gray-600 text-[10px]">Median: {formatMetricValue(stats.median, 'currency')}</span>
              </div>
            </div>
          )}

          {!isPriceMetric && level !== 'state' && (
            <div className="border-t border-white/10 pt-3 mt-3 text-gray-600 text-[10px] text-center">
              Switch to Home Value, List Price, or Sale Price to see affordability breakdown
            </div>
          )}

          {level === 'state' && (
            <div className="border-t border-white/10 pt-3 mt-3 text-gray-600 text-[10px] text-center">
              Click a state to see affordability breakdown by county
            </div>
          )}

          <p className="text-gray-700 text-[9px] mt-3 leading-relaxed">
            Based on 28% DTI ratio, 30-year fixed mortgage. Does not include taxes, insurance, or HOA. For informational purposes only.
          </p>
        </div>
      )}
    </div>
  );
}
