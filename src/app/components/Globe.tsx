'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { StateMetric, TimePeriod } from '../types';
import { heatColors } from '../lib/metrics-config';

interface StateHeatData {
  state_code: string;
  state_name: string;
  heat_index: number;
  metro_count: number;
  metros: { name: string; heat_index: number; sizeRank: number; change?: number }[];
  change?: number;
}

interface GlobeProps {
  selectedPeriod: TimePeriod;
  selectedState: StateMetric | null;
  onStateSelect: (state: StateMetric | null) => void;
}

export default function Globe({ selectedPeriod, selectedState, onStateSelect }: GlobeProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [stateData, setStateData] = useState<StateHeatData[]>([]);
  const stateDataRef = useRef<StateHeatData[]>([]);

  useEffect(() => {
    stateDataRef.current = stateData;
  }, [stateData]);

  // Update selected state panel when data changes (e.g. period switch)
  const selectedStateRef = useRef<StateMetric | null>(null);
  selectedStateRef.current = selectedState;

  useEffect(() => {
    if (!selectedStateRef.current || stateData.length === 0) return;
    const updated = stateData.find((s) => s.state_code === selectedStateRef.current!.state_code);
    if (updated) {
      onStateSelect(updated);
    }
  }, [stateData, onStateSelect]);

  // Load heat data when period changes
  useEffect(() => {
    fetch(`/api/heat-data?period=${selectedPeriod}`)
      .then((res) => res.json())
      .then((data) => setStateData(data));
  }, [selectedPeriod]);

  // Get color for a state based on heat index
  const getStateColor = useCallback((stateName: string, data: StateHeatData[]): string => {
    // Match by state name
    const state = data.find((s) => s.state_name === stateName);
    if (!state) return '#1a1a1a';

    const value = state.heat_index;
    const min = 30;
    const max = 100;

    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const colorIndex = Math.floor(normalized * (heatColors.length - 1));
    return heatColors[colorIndex];
  }, []);

  // Build color expression for Mapbox - use state NAME to match GeoJSON
  const buildColorExpression = useCallback((data: StateHeatData[]): mapboxgl.Expression => {
    const expression: (string | string[])[] = ['match', ['get', 'name']];

    data.forEach((state) => {
      expression.push(state.state_name);
      expression.push(getStateColor(state.state_name, data));
    });

    expression.push('#1a1a1a');

    return expression as mapboxgl.Expression;
  }, [getStateColor]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error('Mapbox token not found');
      return;
    }

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-98, 39],
      zoom: 3.5,
      projection: 'globe',
      antialias: true,
    });

    popup.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    map.current.on('style.load', () => {
      if (!map.current) return;

      map.current.setFog({
        color: 'rgb(0, 0, 0)',
        'high-color': 'rgb(10, 10, 15)',
        'horizon-blend': 0.03,
        'space-color': 'rgb(0, 0, 0)',
        'star-intensity': 0.4,
      });

      map.current.addSource('states', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json',
      });

      map.current.addLayer({
        id: 'states-fill',
        type: 'fill',
        source: 'states',
        paint: {
          'fill-color': '#1a1a1a',
          'fill-opacity': 0.4,
        },
      });

      map.current.addLayer({
        id: 'states-border',
        type: 'line',
        source: 'states',
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.15)',
          'line-width': 0.5,
        },
      });

      map.current.addLayer({
        id: 'states-highlight',
        type: 'line',
        source: 'states',
        paint: {
          'line-color': '#ffffff',
          'line-width': 2,
          'line-opacity': 0,
        },
      });

      // Make all labels white with no outline
      const style = map.current.getStyle();
      if (style?.layers) {
        style.layers.forEach((layer) => {
          if (layer.type === 'symbol') {
            map.current?.setPaintProperty(layer.id, 'text-color', '#ffffff');
            map.current?.setPaintProperty(layer.id, 'text-halo-color', 'transparent');
            map.current?.setPaintProperty(layer.id, 'text-halo-width', 0);
          }
        });
      }

      setIsMapLoaded(true);
    });

    // Hover - only on non-touch devices
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (!isTouchDevice) {
      map.current.on('mousemove', 'states-fill', (e) => {
        if (!map.current || !popup.current || !e.features?.[0]) return;

        map.current.getCanvas().style.cursor = 'pointer';

        const stateName = e.features[0].properties?.name;
        const state = stateDataRef.current.find((s) => s.state_name === stateName);

        if (state) {
          const changeHtml = state.change && state.change !== 0
            ? ` <span style="color: #6b7280; font-size: 11px;">→</span> <span style="color: ${state.change > 0 ? '#4ade80' : '#f87171'}; font-size: 11px;">${state.heat_index + state.change} now</span>`
            : '';

          popup.current
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="px-4 py-3">
                <div class="font-medium text-white text-sm">${state.state_name}</div>
                <div class="text-gray-400 text-xs mt-1">Heat Index: <span class="text-white">${state.heat_index}</span>${changeHtml}</div>
                <div class="text-gray-500 text-xs mt-1">${state.metro_count} metro${state.metro_count > 1 ? 's' : ''}</div>
              </div>
            `)
            .addTo(map.current);

          map.current.setPaintProperty('states-highlight', 'line-opacity', [
            'case',
            ['==', ['get', 'name'], stateName],
            1,
            0,
          ]);
        }
      });

      map.current.on('mouseleave', 'states-fill', () => {
        if (!map.current || !popup.current) return;
        map.current.getCanvas().style.cursor = '';
        popup.current.remove();
        map.current.setPaintProperty('states-highlight', 'line-opacity', 0);
      });
    }

    // Click - match by state name
    map.current.on('click', 'states-fill', (e) => {
      if (!e.features?.[0]) return;
      const stateName = e.features[0].properties?.name;
      const state = stateDataRef.current.find((s) => s.state_name === stateName);
      onStateSelect(state || null);
    });

    if (!isTouchDevice) {
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [onStateSelect]);

  // Update colors when data changes
  useEffect(() => {
    if (!map.current || !isMapLoaded || stateData.length === 0) return;

    map.current.setPaintProperty('states-fill', 'fill-color', buildColorExpression(stateData));
  }, [stateData, isMapLoaded, buildColorExpression]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
