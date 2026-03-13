'use client';

import {
  DrillDownState,
  StateMetric,
  CountyMetric,
  ZipMetric,
  MetricKey,
} from '../types';
import { getHeatColor, getHeatLabel, heatColors, METRIC_CONFIGS, formatMetricValue, getMetricColor } from '../lib/metrics-config';

interface DetailPanelProps {
  drillDown: DrillDownState;
  selectedMetric: MetricKey;
  states: StateMetric[];
  counties: CountyMetric[];
  zips: ZipMetric[];
  onClose: () => void;
  onGoBack: () => void;
  onCountyClick: (countyName: string, countyFips: string, stateCode: string, stateName: string) => void;
}

function ValueDisplay({ value, metric }: { value: number; metric: MetricKey }) {
  const config = METRIC_CONFIGS[metric];
  const color = metric === 'heat_index' ? getHeatColor(value) : getMetricColor(value, metric);
  const formatted = formatMetricValue(value, config.format);
  return (
    <span className="text-sm font-medium" style={{ color }}>
      {formatted}
    </span>
  );
}

function LargeValueDisplay({ value, metric }: { value: number; metric: MetricKey }) {
  const config = METRIC_CONFIGS[metric];
  const color = metric === 'heat_index' ? getHeatColor(value) : getMetricColor(value, metric);
  const formatted = formatMetricValue(value, config.format);
  return (
    <span className="text-xl md:text-2xl font-light" style={{ color }}>
      {formatted}
    </span>
  );
}

function MetricLabel({ value, metric }: { value: number; metric: MetricKey }) {
  if (metric === 'heat_index') {
    return (
      <span className="text-sm" style={{ color: getHeatColor(value) }}>
        {getHeatLabel(value)}
      </span>
    );
  }
  return null;
}

function HeatBar({ value, metric }: { value: number; metric: MetricKey }) {
  if (metric !== 'heat_index') return null;
  return (
    <div className="h-1.5 bg-gray-800/60 rounded-full overflow-hidden mt-2">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min(100, (value / 100) * 100)}%`,
          background: `linear-gradient(to right, ${heatColors[0]}, ${getHeatColor(value)})`,
        }}
      />
    </div>
  );
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

// === STATE DETAIL (shows counties) ===
function StateDetail({
  state,
  counties,
  metric,
  onCountyClick,
}: {
  state: StateMetric;
  counties: CountyMetric[];
  metric: MetricKey;
  onCountyClick: DetailPanelProps['onCountyClick'];
}) {
  return (
    <>
      <div className="mb-4 md:mb-6">
        <div className="flex justify-between items-baseline">
          <span className="text-gray-500 text-xs tracking-wide">State Average</span>
          <span>
            <LargeValueDisplay value={state.heat_index} metric="heat_index" />
            <ChangeIndicator change={state.change} currentValue={state.heat_index} />
          </span>
        </div>
        <div className="mt-1">
          <MetricLabel value={state.heat_index} metric="heat_index" />
        </div>
        <HeatBar value={state.heat_index} metric="heat_index" />
      </div>

      {counties.length > 0 && (
        <div>
          <h3 className="text-gray-400 text-xs tracking-wide mb-3 uppercase">
            Counties ({counties.length})
          </h3>
          <div className="space-y-1">
            {counties
              .sort((a, b) => b.heat_index - a.heat_index)
              .map((county) => (
                <button
                  key={county.fips}
                  onClick={() =>
                    onCountyClick(county.county_name, county.fips, county.state_code, county.state_name)
                  }
                  className="w-full py-2 px-2 -mx-2 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg transition-colors text-left group"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm truncate pr-2 group-hover:text-white transition-colors">
                      {county.county_name.replace(' County', '')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>
                        <ValueDisplay value={county.heat_index} metric={metric} />
                        {metric === 'heat_index' && (
                          <ChangeIndicator change={county.change} currentValue={county.heat_index} />
                        )}
                      </span>
                      <svg className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  <MetricLabel value={county.heat_index} metric={metric} />
                </button>
              ))}
          </div>
        </div>
      )}

      {counties.length === 0 && state.metros && state.metros.length > 0 && (
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
                    <ValueDisplay value={metro.heat_index} metric="heat_index" />
                    <ChangeIndicator change={metro.change} currentValue={metro.heat_index} />
                  </span>
                </div>
                <MetricLabel value={metro.heat_index} metric="heat_index" />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// === COUNTY DETAIL (shows ZIPs) ===
function CountyDetail({ county, zips, metric }: { county: CountyMetric; zips: ZipMetric[]; metric: MetricKey }) {
  return (
    <>
      <div className="mb-4 md:mb-6">
        <div className="flex justify-between items-baseline">
          <span className="text-gray-500 text-xs tracking-wide">County Average</span>
          <span>
            <LargeValueDisplay value={county.heat_index} metric={metric} />
            {metric === 'heat_index' && (
              <ChangeIndicator change={county.change} currentValue={county.heat_index} />
            )}
          </span>
        </div>
        <div className="mt-1">
          <MetricLabel value={county.heat_index} metric={metric} />
        </div>
        <HeatBar value={county.heat_index} metric={metric} />
        {county.metro && (
          <p className="text-gray-600 text-xs mt-2">{county.metro}</p>
        )}
      </div>

      {zips.length > 0 && (
        <div>
          <h3 className="text-gray-400 text-xs tracking-wide mb-3 uppercase">
            ZIP Codes ({zips.length})
          </h3>
          <div className="space-y-1">
            {zips
              .sort((a, b) => b.heat_index - a.heat_index)
              .map((zip) => (
                <div
                  key={zip.zip_code}
                  className="py-2 px-2 -mx-2 border-b border-white/5 last:border-0"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-gray-300 text-sm font-mono">{zip.zip_code}</span>
                      {zip.city && (
                        <span className="text-gray-600 text-xs ml-2">{zip.city}</span>
                      )}
                    </div>
                    <span>
                      <ValueDisplay value={zip.heat_index} metric={metric} />
                      {metric === 'heat_index' && (
                        <ChangeIndicator change={zip.change} currentValue={zip.heat_index} />
                      )}
                    </span>
                  </div>
                  <MetricLabel value={zip.heat_index} metric={metric} />
                </div>
              ))}
          </div>
        </div>
      )}

      {zips.length === 0 && (
        <div className="text-gray-600 text-sm text-center py-6">
          No data available for this county
        </div>
      )}
    </>
  );
}

// === MAIN PANEL ===
export default function DetailPanel({
  drillDown,
  selectedMetric,
  states,
  counties,
  zips,
  onClose,
  onGoBack,
  onCountyClick,
}: DetailPanelProps) {
  const metricConfig = METRIC_CONFIGS[selectedMetric];

  if (drillDown.level === 'state') return null;

  const state = states.find((s) => s.state_code === drillDown.stateCode);

  const selectedCounty = drillDown.level === 'zip' && drillDown.countyFips
    ? counties.find((c) => c.fips === drillDown.countyFips) || {
        fips: drillDown.countyFips,
        county_name: drillDown.countyName || '',
        state_code: drillDown.stateCode || '',
        state_name: drillDown.stateName || '',
        heat_index: 0,
      }
    : null;

  const title = drillDown.level === 'zip'
    ? drillDown.countyName || ''
    : drillDown.stateName || '';

  const subtitle = drillDown.level === 'zip'
    ? drillDown.stateName
    : drillDown.stateCode;

  return (
    <div className="absolute bottom-0 left-0 right-0 md:bottom-8 md:left-8 md:right-auto bg-black/80 backdrop-blur-xl rounded-t-2xl md:rounded-2xl p-4 md:p-6 md:w-80 max-h-[60vh] md:max-h-[70vh] overflow-y-auto border border-white/10 z-20">
      <div className="flex justify-center mb-3 md:hidden">
        <div className="w-10 h-1 rounded-full bg-white/20" />
      </div>

      <div className="flex justify-between items-start mb-4 md:mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={onGoBack}
            className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
            title="Go back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg md:text-xl font-light text-white tracking-tight">{title}</h2>
            <p className="text-gray-600 text-xs tracking-wide mt-0.5">{subtitle}</p>
          </div>
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

      {drillDown.level === 'county' && state ? (
        <StateDetail
          state={state}
          counties={counties}
          metric={selectedMetric}
          onCountyClick={(countyName, fips, stateCode, _stateName) =>
            onCountyClick(countyName, fips, stateCode, drillDown.stateName || _stateName)
          }
        />
      ) : drillDown.level === 'zip' && selectedCounty ? (
        <CountyDetail county={selectedCounty} zips={zips} metric={selectedMetric} />
      ) : null}

      <div className="mt-4 md:mt-5 pt-3 md:pt-4 border-t border-white/5">
        <p className="text-gray-600 text-xs tracking-wide">
          Source: Zillow {metricConfig.label}
        </p>
      </div>
    </div>
  );
}
