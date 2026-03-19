import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { periodOffsets } from '@/app/lib/metrics-config';
import { rateLimit } from '@/app/lib/rate-limit';

// GET /api/metrics-data?metric=zhvi&level=county&state=CA&period=1y
// GET /api/metrics-data?metric=zhvi&level=zip&state=CA&county=Los%20Angeles%20County&period=30d

export async function GET(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const metric = request.nextUrl.searchParams.get('metric');
  const level = request.nextUrl.searchParams.get('level');
  const stateCode = request.nextUrl.searchParams.get('state');
  const countyName = request.nextUrl.searchParams.get('county');
  const period = request.nextUrl.searchParams.get('period') || '30d';
  const offset = periodOffsets[period] ?? 0;

  if (!metric || !level || !stateCode) {
    return NextResponse.json({ error: 'Missing metric, level, or state parameter' }, { status: 400 });
  }

  if (level === 'zip' && !countyName) {
    return NextResponse.json({ error: 'Missing county parameter for ZIP level' }, { status: 400 });
  }

  try {
    const table = level === 'county' ? 'county_metrics' : 'zip_metrics';
    const idCol = level === 'county' ? 'fips' : 'zip_code';

    // Get a sample record to find available dates
    let sampleQuery = supabase
      .from(table)
      .select(idCol)
      .eq('metric', metric)
      .eq('state_code', stateCode);

    if (level === 'zip' && countyName) {
      sampleQuery = sampleQuery.eq('county_name', countyName);
    }

    const { data: sampleRows } = await sampleQuery.limit(1);
    if (!sampleRows || sampleRows.length === 0) {
      return NextResponse.json([]);
    }

    const sampleId = (sampleRows[0] as Record<string, string>)[idCol];

    // Get all dates for this sample record
    const { data: dateRows } = await supabase
      .from(table)
      .select('date')
      .eq(idCol, sampleId)
      .eq('metric', metric)
      .order('date', { ascending: true });

    if (!dateRows || dateRows.length === 0) {
      return NextResponse.json([]);
    }

    const uniqueDates = [...new Set(dateRows.map((r) => r.date))].sort();
    const latestDate = uniqueDates[uniqueDates.length - 1];
    const targetIndex = Math.max(0, uniqueDates.length - 1 - offset);
    const targetDate = uniqueDates[targetIndex];

    // Fetch data for the target date
    let dataQuery = supabase
      .from(table)
      .select('*')
      .eq('metric', metric)
      .eq('state_code', stateCode)
      .eq('date', targetDate);

    if (level === 'zip' && countyName) {
      dataQuery = dataQuery.eq('county_name', countyName);
    }

    const { data, error } = await dataQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Compute change if historical period
    if (offset > 0 && targetDate !== latestDate && data) {
      let latestQuery = supabase
        .from(table)
        .select(`${idCol}, value`)
        .eq('metric', metric)
        .eq('state_code', stateCode)
        .eq('date', latestDate);

      if (level === 'zip' && countyName) {
        latestQuery = latestQuery.eq('county_name', countyName);
      }

      const { data: latestData } = await latestQuery;

      if (latestData) {
        const latestMap = new Map(
          latestData.map((r: Record<string, unknown>) => [(r as Record<string, string>)[idCol], r.value as number])
        );
        for (const row of data as Record<string, unknown>[]) {
          const latestVal = latestMap.get((row as Record<string, string>)[idCol]);
          if (latestVal !== undefined && row.value !== null) {
            row.change = (latestVal as number) - (row.value as number);
          }
        }
      }
    }

    // For ZIP level, join with centroids
    if (level === 'zip' && data && data.length > 0) {
      const zipCodes = data.map((r) => r.zip_code);
      const { data: centroidData } = await supabase
        .from('zip_centroids')
        .select('zip_code, lat, lng')
        .in('zip_code', zipCodes);

      const centroidMap = new Map(
        (centroidData || []).map((c) => [c.zip_code, { lat: c.lat, lng: c.lng }])
      );

      return NextResponse.json(
        data
          .map((row) => {
            const centroid = centroidMap.get(row.zip_code);
            return { ...row, lat: centroid?.lat ?? null, lng: centroid?.lng ?? null };
          })
          .filter((r) => r.lat !== null),
        { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
      );
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    console.error('Metrics data error:', err);
    return NextResponse.json({ error: 'Failed to fetch metrics data' }, { status: 500 });
  }
}
