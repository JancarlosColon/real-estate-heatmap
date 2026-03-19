import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { rateLimit } from '@/app/lib/rate-limit';

export async function GET(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const q = request.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ states: [], counties: [], zips: [] });
  }

  const isNumeric = /^\d+$/.test(q);

  // Run searches in parallel
  const [statesRes, countiesRes, zipsRes] = await Promise.all([
    // States: ilike search on state_name
    isNumeric
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from('us_states')
          .select('state_code, state_name')
          .ilike('state_name', `%${q}%`)
          .limit(5),

    // Counties: ilike search on county_name (distinct via latest date)
    isNumeric
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from('county_heat_index')
          .select('fips, county_name, state_code')
          .ilike('county_name', `%${q}%`)
          .order('date', { ascending: false })
          .limit(5),

    // ZIPs: prefix match on zip_code
    isNumeric
      ? supabase
          .from('zip_heat_index')
          .select('zip_code, city, county_name, state_code')
          .ilike('zip_code', `${q}%`)
          .order('date', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Deduplicate counties by fips
  const seenFips = new Set<string>();
  const uniqueCounties = (countiesRes.data || []).filter((c: any) => {
    if (seenFips.has(c.fips)) return false;
    seenFips.add(c.fips);
    return true;
  });

  // Deduplicate zips by zip_code
  const seenZips = new Set<string>();
  const uniqueZips = (zipsRes.data || []).filter((z: any) => {
    if (seenZips.has(z.zip_code)) return false;
    seenZips.add(z.zip_code);
    return true;
  }).slice(0, 5);

  // Look up FIPS for each ZIP's county
  const zipCountyPairs = [...new Set(uniqueZips.map((z: any) => `${z.county_name}|${z.state_code}`))];
  const fipsMap = new Map<string, string>();
  if (zipCountyPairs.length > 0) {
    for (const pair of zipCountyPairs) {
      const [countyName, stateCode] = pair.split('|');
      const { data: countyRow } = await supabase
        .from('county_heat_index')
        .select('fips')
        .eq('county_name', countyName)
        .eq('state_code', stateCode)
        .limit(1);
      if (countyRow && countyRow.length > 0) {
        fipsMap.set(pair, countyRow[0].fips);
      }
    }
  }

  const zipsWithFips = uniqueZips.map((z: any) => ({
    ...z,
    fips: fipsMap.get(`${z.county_name}|${z.state_code}`) || null,
  }));

  return NextResponse.json({
    states: statesRes.data || [],
    counties: uniqueCounties.slice(0, 5),
    zips: zipsWithFips,
  });
}
