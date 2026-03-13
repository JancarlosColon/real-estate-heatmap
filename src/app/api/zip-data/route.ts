import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { periodOffsets } from '@/app/lib/metrics-config';

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') || '30d';
  const countyName = request.nextUrl.searchParams.get('county');
  const stateCode = request.nextUrl.searchParams.get('state');
  const offset = periodOffsets[period] ?? 0;

  if (!countyName || !stateCode) {
    return NextResponse.json({ error: 'Missing county and/or state parameter' }, { status: 400 });
  }

  try {
    // Get distinct dates — pick one ZIP from this county to get its dates
    const { data: sampleZip } = await supabase
      .from('zip_heat_index')
      .select('zip_code')
      .eq('state_code', stateCode)
      .eq('county_name', countyName)
      .limit(1);

    if (!sampleZip || sampleZip.length === 0) {
      return NextResponse.json([]);
    }

    const { data: dates } = await supabase
      .from('zip_heat_index')
      .select('date')
      .eq('zip_code', sampleZip[0].zip_code)
      .order('date', { ascending: true });

    if (!dates || dates.length === 0) {
      return NextResponse.json([]);
    }

    const uniqueDates = [...new Set(dates.map((r) => r.date))].sort();
    const latestDate = uniqueDates[uniqueDates.length - 1];
    const targetIndex = Math.max(0, uniqueDates.length - 1 - offset);
    const targetDate = uniqueDates[targetIndex];

    // Fetch ZIP data for target date
    const { data, error } = await supabase
      .from('zip_heat_index')
      .select('zip_code, city, county_name, state_code, heat_index')
      .eq('state_code', stateCode)
      .eq('county_name', countyName)
      .eq('date', targetDate);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch centroids for these ZIPs
    const zipCodes = (data || []).map((r) => r.zip_code);
    const { data: centroidData } = await supabase
      .from('zip_centroids')
      .select('zip_code, lat, lng')
      .in('zip_code', zipCodes);

    const centroidMap = new Map(
      (centroidData || []).map((c) => [c.zip_code, { lat: c.lat, lng: c.lng }])
    );

    // Compute change if historical period
    let latestMap: Map<string, number> | null = null;
    if (offset > 0 && targetDate !== latestDate) {
      const { data: latestData } = await supabase
        .from('zip_heat_index')
        .select('zip_code, heat_index')
        .eq('state_code', stateCode)
        .eq('county_name', countyName)
        .eq('date', latestDate);

      if (latestData) {
        latestMap = new Map(latestData.map((r) => [r.zip_code, r.heat_index]));
      }
    }

    const zips = (data || [])
      .map((row) => {
        const centroid = centroidMap.get(row.zip_code);
        let change: number | undefined;
        if (latestMap) {
          const latestHeat = latestMap.get(row.zip_code);
          if (latestHeat !== undefined && row.heat_index !== null) {
            change = Math.round(latestHeat - row.heat_index);
          }
        }
        return {
          zip_code: row.zip_code,
          city: row.city,
          county_name: row.county_name,
          state_code: row.state_code,
          heat_index: row.heat_index !== null ? Math.round(row.heat_index) : null,
          lat: centroid?.lat ?? null,
          lng: centroid?.lng ?? null,
          change,
        };
      })
      .filter((z) => z.heat_index !== null && z.lat !== null);

    return NextResponse.json(zips, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    console.error('ZIP data error:', err);
    return NextResponse.json({ error: 'Failed to fetch ZIP data' }, { status: 500 });
  }
}
