import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { periodOffsets } from '@/app/lib/metrics-config';
import { rateLimit } from '@/app/lib/rate-limit';

export async function GET(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const period = request.nextUrl.searchParams.get('period') || '30d';
  const stateCode = request.nextUrl.searchParams.get('state');
  const offset = periodOffsets[period] ?? 0;

  if (!stateCode) {
    return NextResponse.json({ error: 'Missing state parameter' }, { status: 400 });
  }

  try {
    // Get distinct dates — pick one county from this state to get its dates (avoids 1000-row limit)
    const { data: sampleCounty } = await supabase
      .from('county_heat_index')
      .select('fips')
      .eq('state_code', stateCode)
      .limit(1);

    if (!sampleCounty || sampleCounty.length === 0) {
      return NextResponse.json([]);
    }

    const { data: dates } = await supabase
      .from('county_heat_index')
      .select('date')
      .eq('fips', sampleCounty[0].fips)
      .order('date', { ascending: true });

    if (!dates || dates.length === 0) {
      return NextResponse.json([]);
    }

    const uniqueDates = [...new Set(dates.map((r) => r.date))].sort();
    const latestDate = uniqueDates[uniqueDates.length - 1];
    const targetIndex = Math.max(0, uniqueDates.length - 1 - offset);
    const targetDate = uniqueDates[targetIndex];

    // Fetch county data for the target date
    const { data, error } = await supabase
      .from('county_heat_index')
      .select('fips, county_name, state_code, metro, heat_index')
      .eq('state_code', stateCode)
      .eq('date', targetDate);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Compute change if historical period
    if (offset > 0 && targetDate !== latestDate) {
      const { data: latestData } = await supabase
        .from('county_heat_index')
        .select('fips, heat_index')
        .eq('state_code', stateCode)
        .eq('date', latestDate);

      if (latestData) {
        const latestMap = new Map(latestData.map((r) => [r.fips, r.heat_index]));
        for (const county of data as { fips: string; heat_index: number; change?: number }[]) {
          const latestHeat = latestMap.get(county.fips);
          if (latestHeat !== undefined && county.heat_index !== null) {
            county.change = Math.round(latestHeat - county.heat_index);
          }
        }
      }
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    console.error('County data error:', err);
    return NextResponse.json({ error: 'Failed to fetch county data' }, { status: 500 });
  }
}
