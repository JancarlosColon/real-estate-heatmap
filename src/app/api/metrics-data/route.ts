import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

// Fetch metric data for counties or ZIPs from the unified metrics tables
// GET /api/metrics-data?metric=zhvi&level=county&state=CA
// GET /api/metrics-data?metric=zhvi&level=zip&state=CA&county=Los%20Angeles%20County

export async function GET(request: NextRequest) {
  const metric = request.nextUrl.searchParams.get('metric');
  const level = request.nextUrl.searchParams.get('level'); // 'county' or 'zip'
  const stateCode = request.nextUrl.searchParams.get('state');
  const countyName = request.nextUrl.searchParams.get('county');

  if (!metric || !level || !stateCode) {
    return NextResponse.json({ error: 'Missing metric, level, or state parameter' }, { status: 400 });
  }

  if (level === 'zip' && !countyName) {
    return NextResponse.json({ error: 'Missing county parameter for ZIP level' }, { status: 400 });
  }

  try {
    const table = level === 'county' ? 'county_metrics' : 'zip_metrics';

    // Get latest date for this metric
    let sampleQuery = supabase
      .from(table)
      .select('date')
      .eq('metric', metric)
      .eq('state_code', stateCode);

    if (level === 'zip' && countyName) {
      sampleQuery = sampleQuery.eq('county_name', countyName);
    }

    const { data: sampleRows } = await sampleQuery.order('date', { ascending: false }).limit(1);

    if (!sampleRows || sampleRows.length === 0) {
      return NextResponse.json([]);
    }

    const latestDate = sampleRows[0].date;

    // Fetch data for the latest date
    let dataQuery = supabase
      .from(table)
      .select('*')
      .eq('metric', metric)
      .eq('state_code', stateCode)
      .eq('date', latestDate);

    if (level === 'zip' && countyName) {
      dataQuery = dataQuery.eq('county_name', countyName);
    }

    const { data, error } = await dataQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
