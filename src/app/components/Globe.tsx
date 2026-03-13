'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  GeoLevel,
  TimePeriod,
  MetricKey,
  StateMetric,
  CountyMetric,
  ZipMetric,
  DrillDownState,
} from '../types';
import { heatColors, getHeatColor, getMetricColor, GEO_SOURCES, METRIC_CONFIGS, formatMetricValue } from '../lib/metrics-config';

interface GlobeProps {
  selectedPeriod: TimePeriod;
  selectedMetric: MetricKey;
  drillDown: DrillDownState;
  states: StateMetric[];
  counties: CountyMetric[];
  zips: ZipMetric[];
  loading: boolean;
  onStateClick: (stateCode: string, stateName: string) => void;
  onCountyClick: (countyName: string, countyFips: string, stateCode: string, stateName: string) => void;
  onZipClick?: (zip: ZipMetric) => void;
}

// State name → state code lookup (for GeoJSON which only has names)
const STATE_NAME_TO_CODE: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH',
  'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
  'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA',
  'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN',
  'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
  'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

// State code → approximate center coordinates for camera fly-to
const STATE_CENTERS: Record<string, [number, number]> = {
  AL: [-86.9, 32.8], AK: [-153.5, 64.2], AZ: [-111.1, 34.0], AR: [-91.8, 35.0],
  CA: [-119.4, 36.8], CO: [-105.3, 39.1], CT: [-72.8, 41.6], DE: [-75.5, 39.0],
  FL: [-81.5, 27.6], GA: [-83.5, 32.2], HI: [-155.5, 19.9], ID: [-114.7, 44.1],
  IL: [-89.4, 40.6], IN: [-86.1, 40.3], IA: [-93.1, 42.0], KS: [-98.5, 38.5],
  KY: [-84.3, 37.8], LA: [-91.2, 31.2], ME: [-69.4, 45.3], MD: [-76.6, 39.0],
  MA: [-71.4, 42.4], MI: [-84.5, 44.3], MN: [-94.7, 46.7], MS: [-89.4, 32.3],
  MO: [-91.8, 37.9], MT: [-109.5, 46.8], NE: [-99.9, 41.5], NV: [-116.4, 38.8],
  NH: [-71.6, 43.2], NJ: [-74.4, 40.1], NM: [-105.9, 34.5], NY: [-75.0, 43.0],
  NC: [-80.0, 35.8], ND: [-101.0, 47.5], OH: [-82.9, 40.4], OK: [-97.1, 35.0],
  OR: [-120.6, 43.8], PA: [-77.2, 41.2], RI: [-71.5, 41.7], SC: [-81.0, 34.0],
  SD: [-99.9, 43.9], TN: [-86.6, 35.5], TX: [-99.9, 31.0], UT: [-111.1, 39.3],
  VT: [-72.6, 44.6], VA: [-79.5, 37.4], WA: [-120.7, 47.8], WV: [-80.5, 38.5],
  WI: [-89.6, 43.8], WY: [-107.3, 43.0], DC: [-77.0, 38.9],
};

// State code → zoom level (most states = 6, small states higher)
const STATE_ZOOM: Record<string, number> = {
  AK: 4, HI: 6.5, TX: 5.5, CA: 5.5, MT: 5.5, DC: 10, RI: 8.5, DE: 8, CT: 8, NJ: 7,
  NH: 7, VT: 7, MA: 7.5, MD: 7,
};

export default function Globe({
  selectedPeriod,
  selectedMetric,
  drillDown,
  states,
  counties,
  zips,
  loading,
  onStateClick,
  onCountyClick,
  onZipClick,
}: GlobeProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Refs for data (so event handlers always see latest)
  const statesRef = useRef<StateMetric[]>([]);
  const countiesRef = useRef<CountyMetric[]>([]);
  const zipsRef = useRef<ZipMetric[]>([]);
  const drillDownRef = useRef<DrillDownState>(drillDown);

  useEffect(() => { statesRef.current = states; }, [states]);
  useEffect(() => { countiesRef.current = counties; }, [counties]);
  useEffect(() => { zipsRef.current = zips; }, [zips]);
  useEffect(() => { drillDownRef.current = drillDown; }, [drillDown]);
  const selectedMetricRef = useRef<MetricKey>(selectedMetric);
  useEffect(() => { selectedMetricRef.current = selectedMetric; }, [selectedMetric]);

  // Build state color expression
  const buildStateColorExpression = useCallback((data: StateMetric[]): mapboxgl.Expression => {
    const expression: (string | string[])[] = ['match', ['get', 'name']];
    data.forEach((state) => {
      expression.push(state.state_name);
      expression.push(getHeatColor(state.heat_index));
    });
    expression.push('#1a1a1a');
    return expression as mapboxgl.Expression;
  }, []);

  // Build county color expression (match by FIPS feature.id)
  const buildCountyColorExpression = useCallback((data: CountyMetric[]): mapboxgl.Expression => {
    const metric = selectedMetricRef.current;
    const expression: (string | string[])[] = ['match', ['get', 'GEO_ID']];
    data.forEach((county) => {
      expression.push(`0500000US${county.fips}`);
      expression.push(metric === 'heat_index' ? getHeatColor(county.heat_index) : getMetricColor(county.heat_index, metric));
    });
    expression.push('#1a1a1a');
    return expression as mapboxgl.Expression;
  }, []);

  // Format popup HTML — metricOverride forces a specific metric (e.g. state level always shows heat_index)
  const formatPopup = (name: string, value: number, change?: number, subtitle?: string, metricOverride?: MetricKey) => {
    const metric = metricOverride || selectedMetricRef.current;
    const config = METRIC_CONFIGS[metric];
    const formatted = formatMetricValue(value, config.format);
    const changeHtml = change && change !== 0
      ? ` <span style="color: #6b7280; font-size: 11px;">→</span> <span style="color: ${change > 0 ? '#4ade80' : '#f87171'}; font-size: 11px;">${formatMetricValue(value + change, config.format)} now</span>`
      : '';
    const subtitleHtml = subtitle
      ? `<div class="text-gray-600 text-xs mt-0.5">${subtitle}</div>`
      : '';

    return `
      <div class="px-4 py-3">
        <div class="font-medium text-white text-sm">${name}</div>
        ${subtitleHtml}
        <div class="text-gray-400 text-xs mt-1">${config.shortLabel}: <span class="text-white">${formatted}</span>${changeHtml}</div>
      </div>
    `;
  };

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

      // === STATE LAYERS ===
      map.current.addSource('states', {
        type: 'geojson',
        data: GEO_SOURCES.states,
      });

      map.current.addLayer({
        id: 'states-fill',
        type: 'fill',
        source: 'states',
        paint: {
          'fill-color': '#1a1a1a',
          'fill-opacity': 0.4,
          'fill-color-transition': { duration: 500 },
          'fill-opacity-transition': { duration: 400 },
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

      // === COUNTY LAYERS (initially empty) ===
      map.current.addSource('counties', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'counties-fill',
        type: 'fill',
        source: 'counties',
        paint: {
          'fill-color': '#1a1a1a',
          'fill-opacity': 0,
          'fill-color-transition': { duration: 500 },
          'fill-opacity-transition': { duration: 400 },
        },
      });

      map.current.addLayer({
        id: 'counties-border',
        type: 'line',
        source: 'counties',
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.2)',
          'line-width': 0.8,
          'line-opacity': 0,
        },
      });

      map.current.addLayer({
        id: 'counties-highlight',
        type: 'line',
        source: 'counties',
        paint: {
          'line-color': '#ffffff',
          'line-width': 2,
          'line-opacity': 0,
        },
      });

      // === ZIP LAYERS (circle markers) ===
      map.current.addSource('zips', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'zips-circle',
        type: 'circle',
        source: 'zips',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            6, 4,
            8, 6,
            10, 10,
            12, 16,
          ],
          'circle-color': '#1a1a1a',
          'circle-opacity': 0,
          'circle-stroke-color': 'rgba(255, 255, 255, 0.3)',
          'circle-stroke-width': 1,
          'circle-color-transition': { duration: 500 },
          'circle-opacity-transition': { duration: 400 },
          'circle-stroke-opacity': 0,
        },
      });

      // Make all labels white
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

    // === HOVER HANDLERS ===
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (!isTouchDevice) {
      // State hover
      map.current.on('mousemove', 'states-fill', (e) => {
        if (!map.current || !popup.current || !e.features?.[0]) return;
        if (drillDownRef.current.level !== 'state') return;

        map.current.getCanvas().style.cursor = 'pointer';
        const stateName = e.features[0].properties?.name;
        const state = statesRef.current.find((s) => s.state_name === stateName);

        if (state) {
          popup.current
            .setLngLat(e.lngLat)
            .setHTML(formatPopup(
              state.state_name,
              state.heat_index,
              state.change,
              `${state.metro_count} metro${state.metro_count > 1 ? 's' : ''}`,
              'heat_index'
            ))
            .addTo(map.current);

          map.current.setPaintProperty('states-highlight', 'line-opacity', [
            'case', ['==', ['get', 'name'], stateName], 1, 0,
          ]);
        }
      });

      map.current.on('mouseleave', 'states-fill', () => {
        if (!map.current || !popup.current) return;
        if (drillDownRef.current.level !== 'state') return;
        map.current.getCanvas().style.cursor = '';
        popup.current.remove();
        map.current.setPaintProperty('states-highlight', 'line-opacity', 0);
      });

      // County hover
      map.current.on('mousemove', 'counties-fill', (e) => {
        if (!map.current || !popup.current || !e.features?.[0]) return;
        if (drillDownRef.current.level !== 'county') return;

        map.current.getCanvas().style.cursor = 'pointer';
        const geoId = e.features[0].properties?.GEO_ID;
        const fips = geoId?.replace('0500000US', '');
        const county = countiesRef.current.find((c) => c.fips === fips);

        if (county) {
          popup.current
            .setLngLat(e.lngLat)
            .setHTML(formatPopup(
              county.county_name,
              county.heat_index,
              county.change,
              county.metro || undefined
            ))
            .addTo(map.current);

          map.current.setPaintProperty('counties-highlight', 'line-opacity', [
            'case', ['==', ['get', 'GEO_ID'], geoId], 1, 0,
          ]);
        }
      });

      map.current.on('mouseleave', 'counties-fill', () => {
        if (!map.current || !popup.current) return;
        if (drillDownRef.current.level !== 'county') return;
        map.current.getCanvas().style.cursor = '';
        popup.current.remove();
        map.current.setPaintProperty('counties-highlight', 'line-opacity', 0);
      });

      // ZIP hover
      map.current.on('mousemove', 'zips-circle', (e) => {
        if (!map.current || !popup.current || !e.features?.[0]) return;
        if (drillDownRef.current.level !== 'zip') return;

        map.current.getCanvas().style.cursor = 'pointer';
        const zipCode = e.features[0].properties?.zip_code;
        const zip = zipsRef.current.find((z) => z.zip_code === zipCode);

        if (zip) {
          popup.current
            .setLngLat(e.lngLat)
            .setHTML(formatPopup(
              zip.zip_code,
              zip.heat_index,
              zip.change,
              zip.city || undefined
            ))
            .addTo(map.current);
        }
      });

      map.current.on('mouseleave', 'zips-circle', () => {
        if (!map.current || !popup.current) return;
        if (drillDownRef.current.level !== 'zip') return;
        map.current.getCanvas().style.cursor = '';
        popup.current.remove();
      });
    }

    // === CLICK HANDLERS ===
    // State click → drill to counties
    map.current.on('click', 'states-fill', (e) => {
      if (!e.features?.[0]) return;
      if (drillDownRef.current.level !== 'state') return;

      const stateName = e.features[0].properties?.name;
      const stateCode = STATE_NAME_TO_CODE[stateName];
      if (stateCode && stateName) {
        popup.current?.remove();
        onStateClick(stateCode, stateName);
      }
    });

    // County click → drill to ZIPs
    map.current.on('click', 'counties-fill', (e) => {
      if (!e.features?.[0]) return;
      if (drillDownRef.current.level !== 'county') return;

      const geoId = e.features[0].properties?.GEO_ID;
      const fips = geoId?.replace('0500000US', '');
      const county = countiesRef.current.find((c) => c.fips === fips);
      if (county) {
        popup.current?.remove();
        onCountyClick(county.county_name, county.fips, county.state_code, county.state_name);
      }
    });

    // ZIP click
    map.current.on('click', 'zips-circle', (e) => {
      if (!e.features?.[0]) return;
      if (drillDownRef.current.level !== 'zip') return;

      const zipCode = e.features[0].properties?.zip_code;
      const zip = zipsRef.current.find((z) => z.zip_code === zipCode);
      if (zip && onZipClick) {
        onZipClick(zip);
      }
    });

    if (!isTouchDevice) {
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // === UPDATE STATE COLORS ===
  useEffect(() => {
    if (!map.current || !isMapLoaded || states.length === 0) return;

    const isStateLevel = drillDown.level === 'state';
    map.current.setPaintProperty('states-fill', 'fill-color',
      isStateLevel ? buildStateColorExpression(states) : '#1a1a1a'
    );
    map.current.setPaintProperty('states-fill', 'fill-opacity', isStateLevel ? 0.4 : 0.1);
    map.current.setPaintProperty('states-border', 'line-opacity', isStateLevel ? 1 : 0.3);
  }, [states, isMapLoaded, drillDown.level, buildStateColorExpression]);

  // === LOAD COUNTY GEOJSON & UPDATE ===
  const countyGeoJsonLoaded = useRef(false);

  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const showCounties = drillDown.level === 'county' || drillDown.level === 'zip';

    if (showCounties && !countyGeoJsonLoaded.current) {
      // Load county GeoJSON on first drill-down
      fetch(GEO_SOURCES.counties)
        .then((res) => res.json())
        .then((geojson) => {
          if (!map.current) return;
          countyGeoJsonLoaded.current = true;
          (map.current.getSource('counties') as mapboxgl.GeoJSONSource).setData(geojson);
        });
    }

    if (showCounties && counties.length > 0) {
      // Color counties
      map.current.setPaintProperty('counties-fill', 'fill-color', buildCountyColorExpression(counties));
      map.current.setPaintProperty('counties-fill', 'fill-opacity', drillDown.level === 'county' ? 0.55 : 0.25);
      map.current.setPaintProperty('counties-border', 'line-opacity', 1);
    } else if (!showCounties) {
      // Hide counties
      map.current.setPaintProperty('counties-fill', 'fill-opacity', 0);
      map.current.setPaintProperty('counties-border', 'line-opacity', 0);
      map.current.setPaintProperty('counties-highlight', 'line-opacity', 0);
    }
  }, [drillDown.level, counties, isMapLoaded, buildCountyColorExpression]);

  // === UPDATE ZIP CIRCLES ===
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const showZips = drillDown.level === 'zip';

    if (showZips && zips.length > 0) {
      // Build GeoJSON for ZIP circles
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: zips.map((z) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [z.lng, z.lat],
          },
          properties: {
            zip_code: z.zip_code,
            heat_index: z.heat_index,
            city: z.city,
            change: z.change,
          },
        })),
      };

      const zipsSource = map.current.getSource('zips') as mapboxgl.GeoJSONSource | undefined;
      if (!zipsSource) return;
      zipsSource.setData(geojson);

      // Color ZIP circles
      const colorExpr: mapboxgl.Expression = [
        'match', ['get', 'zip_code'],
        ...zips.flatMap((z) => [z.zip_code, selectedMetric === 'heat_index' ? getHeatColor(z.heat_index) : getMetricColor(z.heat_index, selectedMetric)]),
        '#1a1a1a',
      ];

      if (!map.current.getLayer('zips-circle')) return;
      map.current.setPaintProperty('zips-circle', 'circle-color', colorExpr);
      map.current.setPaintProperty('zips-circle', 'circle-opacity', 0.85);
      map.current.setPaintProperty('zips-circle', 'circle-stroke-opacity', 1);
    } else {
      // Hide ZIPs
      map.current.setPaintProperty('zips-circle', 'circle-opacity', 0);
      map.current.setPaintProperty('zips-circle', 'circle-stroke-opacity', 0);
      if (map.current.getSource('zips')) {
        (map.current.getSource('zips') as mapboxgl.GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    }
  }, [drillDown.level, zips, isMapLoaded]);

  // === CAMERA FLY-TO ON DRILL-DOWN ===
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    if (drillDown.level === 'state') {
      // Fly back to US overview
      map.current.flyTo({
        center: [-98, 39],
        zoom: 3.5,
        duration: 1200,
        essential: true,
      });
    } else if (drillDown.level === 'county' && drillDown.stateCode) {
      const center = STATE_CENTERS[drillDown.stateCode];
      const zoom = STATE_ZOOM[drillDown.stateCode] || 6;
      if (center) {
        map.current.flyTo({
          center,
          zoom,
          duration: 1200,
          essential: true,
        });
      }
    } else if (drillDown.level === 'zip' && zips.length > 0) {
      // Compute bounding box of ZIP centroids
      const lngs = zips.map((z) => z.lng);
      const lats = zips.map((z) => z.lat);
      const bounds = new mapboxgl.LngLatBounds(
        [Math.min(...lngs) - 0.1, Math.min(...lats) - 0.1],
        [Math.max(...lngs) + 0.1, Math.max(...lats) + 0.1]
      );
      map.current.fitBounds(bounds, {
        padding: 80,
        duration: 1200,
        maxZoom: 11,
      });
    }
  }, [drillDown.level, drillDown.stateCode, zips, isMapLoaded]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
