'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  GeoLevel,
  TimePeriod,
  MetricKey,
  StateMetric,
  CountyMetric,
  ZipMetric,
  DrillDownState,
} from '../types';

interface DrillDownData {
  states: StateMetric[];
  counties: CountyMetric[];
  zips: ZipMetric[];
}

export function useDrillDown(selectedPeriod: TimePeriod, selectedMetric: MetricKey = 'heat_index') {
  const [drillDown, setDrillDown] = useState<DrillDownState>({ level: 'state' });
  const [data, setData] = useState<DrillDownData>({ states: [], counties: [], zips: [] });
  const [loading, setLoading] = useState(false);
  const countyAbortRef = useRef<AbortController | null>(null);
  const zipAbortRef = useRef<AbortController | null>(null);

  // Fetch state-level data
  const fetchStates = useCallback(async (period: TimePeriod) => {
    try {
      const res = await fetch(`/api/heat-data?period=${period}`);
      const stateData = await res.json();
      setData((prev) => ({ ...prev, states: stateData }));
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Failed to fetch states:', err);
      }
    }
  }, []);

  // Fetch county-level data for a state
  const fetchCounties = useCallback(async (stateCode: string, period: TimePeriod, metric: MetricKey = 'heat_index') => {
    countyAbortRef.current?.abort();
    const controller = new AbortController();
    countyAbortRef.current = controller;

    try {
      const url = metric === 'heat_index'
        ? `/api/county-data?state=${stateCode}&period=${period}`
        : `/api/metrics-data?metric=${metric}&level=county&state=${stateCode}`;
      const res = await fetch(url, { signal: controller.signal });
      const countyData = await res.json();
      if (!controller.signal.aborted) {
        if (metric !== 'heat_index') {
          for (const row of countyData) {
            row.heat_index = row.value;
          }
        }
        setData((prev) => ({ ...prev, counties: countyData }));
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Failed to fetch counties:', err);
      }
    }
  }, []);

  // Fetch ZIP-level data for a county
  const fetchZips = useCallback(
    async (countyName: string, stateCode: string, period: TimePeriod, metric: MetricKey = 'heat_index') => {
      setLoading(true);
      zipAbortRef.current?.abort();
      const controller = new AbortController();
      zipAbortRef.current = controller;

      try {
        const url = metric === 'heat_index'
          ? `/api/zip-data?county=${encodeURIComponent(countyName)}&state=${stateCode}&period=${period}`
          : `/api/metrics-data?metric=${metric}&level=zip&state=${stateCode}&county=${encodeURIComponent(countyName)}`;
        const res = await fetch(url, { signal: controller.signal });
        const zipData = await res.json();
        if (!controller.signal.aborted) {
          if (metric !== 'heat_index') {
            for (const row of zipData) {
              row.heat_index = row.value;
            }
          }
          setData((prev) => ({ ...prev, zips: zipData }));
          setLoading(false);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to fetch zips:', err);
          setLoading(false);
        }
      }
    },
    []
  );

  // Load states on mount and when period changes
  useEffect(() => {
    fetchStates(selectedPeriod);
  }, [selectedPeriod, fetchStates]);

  // Refetch current drill-down level when period or metric changes
  useEffect(() => {
    if (drillDown.level === 'county' && drillDown.stateCode) {
      fetchCounties(drillDown.stateCode, selectedPeriod, selectedMetric);
    } else if (drillDown.level === 'zip' && drillDown.countyName && drillDown.stateCode) {
      // Refetch both counties (for county average display) and ZIPs
      fetchCounties(drillDown.stateCode, selectedPeriod, selectedMetric);
      fetchZips(drillDown.countyName, drillDown.stateCode, selectedPeriod, selectedMetric);
    }
  }, [selectedPeriod, selectedMetric, drillDown, fetchCounties, fetchZips]);

  // Navigate to state view (click on a state from globe)
  const drillToCounty = useCallback(
    (stateCode: string, stateName: string) => {
      setDrillDown({
        level: 'county',
        stateCode,
        stateName,
      });
      fetchCounties(stateCode, selectedPeriod, selectedMetric);
    },
    [selectedPeriod, selectedMetric, fetchCounties]
  );

  // Navigate to ZIP view (click on a county)
  const drillToZip = useCallback(
    (countyName: string, countyFips: string, stateCode: string, stateName: string) => {
      setDrillDown({
        level: 'zip',
        stateCode,
        stateName,
        countyName,
        countyFips,
      });
      // Fetch counties (for county average in panel) and ZIPs in parallel
      // Use separate fetch to avoid abort conflicts
      fetchCounties(stateCode, selectedPeriod, selectedMetric);
      fetchZips(countyName, stateCode, selectedPeriod, selectedMetric);
    },
    [selectedPeriod, selectedMetric, fetchCounties, fetchZips]
  );

  // Navigate back
  const goBack = useCallback(() => {
    if (drillDown.level === 'zip') {
      // Go back to county view
      setDrillDown({
        level: 'county',
        stateCode: drillDown.stateCode,
        stateName: drillDown.stateName,
      });
      if (drillDown.stateCode) {
        fetchCounties(drillDown.stateCode, selectedPeriod, selectedMetric);
      }
    } else if (drillDown.level === 'county') {
      // Go back to state view
      setDrillDown({ level: 'state' });
      setData((prev) => ({ ...prev, counties: [], zips: [] }));
    }
  }, [drillDown, selectedPeriod, selectedMetric, fetchCounties]);

  // Reset to top level
  const resetDrillDown = useCallback(() => {
    setDrillDown({ level: 'state' });
    setData((prev) => ({ ...prev, counties: [], zips: [] }));
  }, []);

  return {
    drillDown,
    data,
    loading,
    drillToCounty,
    drillToZip,
    goBack,
    resetDrillDown,
  };
}
