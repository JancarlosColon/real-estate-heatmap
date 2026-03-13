'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface SearchResult {
  states: { state_code: string; state_name: string }[];
  counties: { fips: string; county_name: string; state_code: string }[];
  zips: { zip_code: string; city: string; county_name: string; state_code: string }[];
}

// Simple state_code → state_name map for county/zip results
const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',
  LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
  OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
  WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
};

interface SearchBarProps {
  onStateSelect: (stateCode: string, stateName: string) => void;
  onCountySelect: (countyName: string, fips: string, stateCode: string, stateName: string) => void;
  onZipSelect: (zipCode: string, city: string, countyName: string, stateCode: string) => void;
}

export default function SearchBar({ onStateSelect, onCountySelect, onZipSelect }: SearchBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
        setQuery('');
        setResults(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Focus input when expanded
  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  // Debounced search
  const search = useCallback((q: string) => {
    clearTimeout(timerRef.current);
    if (q.length < 2) { setResults(null); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    search(val);
  };

  const close = () => {
    setExpanded(false);
    setQuery('');
    setResults(null);
  };

  const hasResults = results && (results.states.length || results.counties.length || results.zips.length);

  return (
    <div ref={containerRef} className="relative z-50">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center justify-center w-10 h-10 rounded-full
                     bg-black/70 backdrop-blur-md border border-white/10
                     text-white/70 hover:text-white hover:bg-white/10
                     transition-all duration-200"
          aria-label="Search"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      ) : (
        <div className="w-72">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg
                          bg-black/90 backdrop-blur-md border border-white/10">
            <svg className="text-white/40 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleChange}
              placeholder="State, county, or ZIP…"
              className="flex-1 bg-transparent text-sm text-white placeholder-white/30
                         outline-none"
            />
            {query && (
              <button onClick={close} className="text-white/40 hover:text-white text-xs">✕</button>
            )}
          </div>

          {/* Dropdown */}
          {(loading || hasResults) && (
            <div className="mt-1 rounded-lg bg-black/90 backdrop-blur-md border border-white/10
                            max-h-72 overflow-y-auto shadow-xl">
              {loading && !hasResults && (
                <div className="px-3 py-2 text-xs text-white/30">Searching…</div>
              )}

              {results?.states.length ? (
                <div>
                  <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-white/30 font-medium">States</div>
                  {results.states.map((s) => (
                    <button
                      key={s.state_code}
                      onClick={() => { onStateSelect(s.state_code, s.state_name); close(); }}
                      className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors"
                    >
                      {s.state_name} <span className="text-white/30 text-xs">({s.state_code})</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {results?.counties.length ? (
                <div>
                  <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-white/30 font-medium">Counties</div>
                  {results.counties.map((c) => (
                    <button
                      key={c.fips}
                      onClick={() => { onCountySelect(c.county_name, c.fips, c.state_code, STATE_NAMES[c.state_code] || c.state_code); close(); }}
                      className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors"
                    >
                      {c.county_name} <span className="text-white/30 text-xs">({c.state_code})</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {results?.zips.length ? (
                <div>
                  <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-white/30 font-medium">ZIP Codes</div>
                  {results.zips.map((z) => (
                    <button
                      key={z.zip_code}
                      onClick={() => { onZipSelect(z.zip_code, z.city, z.county_name, z.state_code); close(); }}
                      className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors"
                    >
                      {z.zip_code} <span className="text-white/30 text-xs">— {z.city}, {z.state_code}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {!loading && results && !hasResults && query.length >= 2 && (
                <div className="px-3 py-2 text-xs text-white/30">No results found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
