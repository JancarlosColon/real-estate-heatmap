import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { periodOffsets } from '@/app/lib/metrics-config';

interface Metro {
  name: string;
  heat_index: number;
  sizeRank: number;
  change?: number;
}

interface StateRow {
  state_code: string;
  state_name: string;
  heat_index: number;
  metro_count: number;
  metros: Metro[];
  change?: number;
}

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') || '30d';
  const offset = periodOffsets[period] ?? 0;

  // Get distinct dates by querying a single state (avoids Supabase 1000-row default limit)
  const { data: dates, error: datesError } = await supabase
    .from('state_heat_summary')
    .select('date')
    .eq('state_code', 'CA')
    .order('date', { ascending: true });

  if (datesError || !dates || dates.length === 0) {
    return NextResponse.json({ error: 'No data available' }, { status: 404 });
  }

  const uniqueDates = dates.map((r: { date: string }) => r.date);
  const latestDate = uniqueDates[uniqueDates.length - 1];

  // Count back from the end by offset
  const targetIndex = Math.max(0, uniqueDates.length - 1 - offset);
  const targetDate = uniqueDates[targetIndex];

  // Fetch state heat data for the target date
  const { data, error } = await supabase
    .from('state_heat_summary')
    .select('state_code, state_name, heat_index, metro_count, metros')
    .eq('date', targetDate);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If viewing a historical period, compute change vs current (30d)
  if (offset > 0 && targetDate !== latestDate) {
    const { data: latestData } = await supabase
      .from('state_heat_summary')
      .select('state_code, heat_index, metros')
      .eq('date', latestDate);

    if (latestData) {
      const latestMap = new Map<string, StateRow>();
      for (const row of latestData as StateRow[]) {
        latestMap.set(row.state_code, row);
      }

      for (const state of data as StateRow[]) {
        const latest = latestMap.get(state.state_code);
        if (latest) {
          state.change = latest.heat_index - state.heat_index;

          // Compute metro-level changes
          const latestMetroMap = new Map<string, number>();
          for (const m of latest.metros) {
            latestMetroMap.set(m.name, m.heat_index);
          }
          for (const metro of state.metros) {
            const latestHeat = latestMetroMap.get(metro.name);
            if (latestHeat !== undefined) {
              metro.change = latestHeat - metro.heat_index;
            }
          }
        }
      }
    }
  }

  return NextResponse.json(data);
}
