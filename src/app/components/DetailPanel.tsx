'use client';

import {
  DrillDownState,
  StateMetric,
  CountyMetric,
  ZipMetric,
} from '../types';
import { getHeatColor, getHeatLabel, heatColors } from '../lib/metrics-config';

interface DetailPanelProps {
  drillDown: DrillDownState;
  states: StateMetric[];
  counties: CountyMetric[];
  zips: ZipMetric[];
  onClose: () => void;
  onCountyClick: (countyName: string, countyFips: string, stateCode: string, stateName: string) => void;
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

function HeatBar({ value }: { value: number }) {
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

// === STATE DETAIL (shows metros) ===
function StateDetail({
  state,
  counties,
  onCountyClick,
}: {
  state: StateMetric;
  counties: CountyMetric[];
  onCountyClick: DetailPanelProps['onCountyClick'];
}) {
  return (
    <>
      <div className="mb-4 md:mb-6">
        <div className="flex justify-between items-baseline">
          <span className="text-gray-500 text-xs tracking-wide">State Average</span>
          <span>
            <span className="text-xl md:text-2xl font-light" style={{ color: getHeatColor(state.heat_index) }}>
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
        <HeatBar value={state.heat_index} />
      </div>

      {/* County list */}
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
                        <span className="text-sm font-medium" style={{ color: getHeatColor(county.heat_index) }}>
                          {county.heat_index}
                        </span>
                        <ChangeIndicator change={county.change} currentValue={county.heat_index} />
                      </span>
                      <svg className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: getHeatColor(county.heat_index) }}>
                    {getHeatLabel(county.heat_index)}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Metro breakdown (from existing data) */}
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
    </>
  );
}

// === COUNTY DETAIL (shows ZIPs) ===
function CountyDetail({ county, zips }: { county: CountyMetric; zips: ZipMetric[] }) {
  return (
    <>
      <div className="mb-4 md:mb-6">
        <div className="flex justify-between items-baseline">
          <span className="text-gray-500 text-xs tracking-wide">County Average</span>
          <span>
            <span className="text-xl md:text-2xl font-light" style={{ color: getHeatColor(county.heat_index) }}>
              {county.heat_index}
            </span>
            <ChangeIndicator change={county.change} currentValue={county.heat_index} />
          </span>
        </div>
        <div className="mt-1">
          <span className="text-sm" style={{ color: getHeatColor(county.heat_index) }}>
            {getHeatLabel(county.heat_index)}
          </span>
        </div>
        <HeatBar value={county.heat_index} />
        {county.metro && (
          <p className="text-gray-600 text-xs mt-2">{county.metro}</p>
        )}
      </div>

      {/* ZIP list */}
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
                      <span className="text-sm font-medium" style={{ color: getHeatColor(zip.heat_index) }}>
                        {zip.heat_index}
                      </span>
                      <ChangeIndicator change={zip.change} currentValue={zip.heat_index} />
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: getHeatColor(zip.heat_index) }}>
                    {getHeatLabel(zip.heat_index)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {zips.length === 0 && (
        <div className="text-gray-600 text-sm text-center py-6">
          No ZIP-level data available for this county
        </div>
      )}
    </>
  );
}

// === MAIN PANEL ===
export default function DetailPanel({
  drillDown,
  states,
  counties,
  zips,
  onClose,
  onCountyClick,
}: DetailPanelProps) {
  if (drillDown.level === 'state') return null;

  // Find the relevant state
  const state = states.find((s) => s.state_code === drillDown.stateCode);

  // For ZIP view, find the selected county
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
      {/* Drag handle - mobile only */}
      <div className="flex justify-center mb-3 md:hidden">
        <div className="w-10 h-1 rounded-full bg-white/20" />
      </div>

      <div className="flex justify-between items-start mb-4 md:mb-5">
        <div>
          <h2 className="text-lg md:text-xl font-light text-white tracking-tight">{title}</h2>
          <p className="text-gray-600 text-xs tracking-wide mt-1">{subtitle}</p>
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
          onCountyClick={(countyName, fips, stateCode, _stateName) =>
            onCountyClick(countyName, fips, stateCode, drillDown.stateName || _stateName)
          }
        />
      ) : drillDown.level === 'zip' && selectedCounty ? (
        <CountyDetail county={selectedCounty} zips={zips} />
      ) : null}

      <div className="mt-4 md:mt-5 pt-3 md:pt-4 border-t border-white/5">
        <p className="text-gray-600 text-xs tracking-wide">
          Source: Zillow Market Heat Index
        </p>
      </div>
    </div>
  );
}
