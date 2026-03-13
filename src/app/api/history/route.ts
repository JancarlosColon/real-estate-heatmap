import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

// Returns up to 12 months of heat_index history for a county (by fips) or ZIP
export async function GET(request: NextRequest) {
  const fips = request.nextUrl.searchParams.get('fips');
  const zip = request.nextUrl.searchParams.get('zip');

  if (!fips && !zip) {
    return NextResponse.json({ error: 'Missing fips or zip parameter' }, { status: 400 });
  }

  try {
    if (fips) {
      const { data, error } = await supabase
        .from('county_heat_index')
        .select('date, heat_index')
        .eq('fips', fips)
        .order('date', { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Last 12 entries
      const history = (data || []).slice(-12);
      const yoy = history.length >= 12
        ? Math.round(history[history.length - 1].heat_index - history[0].heat_index)
        : null;

      return NextResponse.json({ history, yoy }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      });
    }

    if (zip) {
      const { data, error } = await supabase
        .from('zip_heat_index')
        .select('date, heat_index')
        .eq('zip_code', zip)
        .order('date', { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const history = (data || []).slice(-12);
      const yoy = history.length >= 12
        ? Math.round(history[history.length - 1].heat_index - history[0].heat_index)
        : null;

      return NextResponse.json({ history, yoy }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      });
    }
  } catch (err) {
    console.error('History error:', err);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
