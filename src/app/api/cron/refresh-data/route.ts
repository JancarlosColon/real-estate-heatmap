import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Triggered by Vercel Cron on the 17th of each month.
// Only inserts the LATEST month from each CSV — not the full history.
// Full historical seed is done via scripts/seed-county-zip-data.ts

const ZILLOW_CDN = 'https://files.zillowstatic.com/research/public_csvs';
const BATCH_SIZE = 200;
const MAX_RETRIES = 3;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

// ─── Auth ────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}`;
}

// ─── CSV Parser ──────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
    else current += char;
  }
  values.push(current.trim());
  return values;
}

function parseCSV(text: string) {
  const lines = text.trim().split('\n');
  const headers = parseCsvLine(lines[0]);
  const dateColumns = headers.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h));
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length >= 5) rows.push(values);
  }
  return { headers, rows, dateColumns };
}

// ─── Batch upsert with retry ────────────────────────────────────

async function batchUpsert(
  supabase: AnySupabase,
  table: string,
  rows: Record<string, unknown>[],
  conflictKey: string
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    let retries = MAX_RETRIES;
    while (retries > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(table) as any).upsert(batch, { onConflict: conflictKey });
      if (!error) break;
      retries--;
      if (retries === 0) throw new Error(`${table} upsert failed at ${i}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
    inserted += batch.length;
  }
  return inserted;
}

// ─── Seed functions (LATEST MONTH ONLY) ─────────────────────────

async function seedMetroData(supabase: AnySupabase) {
  const res = await fetch(`${ZILLOW_CDN}/market_temp_index/Metro_market_temp_index_uc_sfrcondo_month.csv`);
  if (!res.ok) throw new Error(`Metro CSV fetch failed: ${res.status}`);
  const { headers, rows, dateColumns } = parseCSV(await res.text());

  const latestDate = dateColumns[dateColumns.length - 1];
  const latestIdx = headers.indexOf(latestDate);

  // Upsert metro_regions (always full — it's small)
  const regions = rows.map((row) => ({
    region_id: parseInt(row[0]),
    size_rank: parseInt(row[1]) || 999,
    region_name: row[2],
    region_type: row[3],
    state_code: row[4] || null,
  }));
  await batchUpsert(supabase, 'metro_regions', regions, 'region_id');

  // Upsert heat index for LATEST MONTH only
  const heatRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const val = parseFloat(row[latestIdx]);
    if (!isNaN(val)) {
      heatRows.push({ region_id: parseInt(row[0]), date: latestDate, heat_value: val });
    }
  }
  const count = await batchUpsert(supabase, 'metro_market_temp_index', heatRows, 'region_id,date');

  // Refresh materialized view
  try { await supabase.rpc('refresh_state_heat_summary'); } catch { /* may not exist */ }

  return { metros: regions.length, heatRows: count, latestDate };
}

async function seedCountyData(supabase: AnySupabase) {
  const res = await fetch(`${ZILLOW_CDN}/market_temp_index/County_market_temp_index_uc_sfrcondo_month.csv`);
  if (!res.ok) throw new Error(`County CSV fetch failed: ${res.status}`);
  const { headers, rows, dateColumns } = parseCSV(await res.text());

  const latestDate = dateColumns[dateColumns.length - 1];
  const latestIdx = headers.indexOf(latestDate);

  const countyRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const val = parseFloat(row[latestIdx]);
    if (isNaN(val)) continue;

    const stateFips = (row[headers.indexOf('StateCodeFIPS')] || '').padStart(2, '0');
    const countyFips = (row[headers.indexOf('MunicipalCodeFIPS')] || '').padStart(3, '0');

    countyRows.push({
      fips: stateFips + countyFips,
      county_name: row[2],
      state_code: row[headers.indexOf('State')] || row[4],
      metro: row[headers.indexOf('Metro')] || null,
      date: latestDate,
      heat_index: Math.round(val),
    });
  }

  const count = await batchUpsert(supabase, 'county_heat_index', countyRows, 'fips,date');
  return { counties: countyRows.length, rows: count, latestDate };
}

async function seedZipData(supabase: AnySupabase) {
  const res = await fetch(`${ZILLOW_CDN}/market_temp_index/Zip_market_temp_index_uc_sfrcondo_month.csv`);
  if (!res.ok) throw new Error(`ZIP CSV fetch failed: ${res.status}`);
  const { headers, rows, dateColumns } = parseCSV(await res.text());

  const latestDate = dateColumns[dateColumns.length - 1];
  const latestIdx = headers.indexOf(latestDate);

  const zipRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const val = parseFloat(row[latestIdx]);
    if (isNaN(val)) continue;

    zipRows.push({
      zip_code: row[2],
      city: row[headers.indexOf('City')] || null,
      county_name: row[headers.indexOf('CountyName')] || null,
      state_code: row[headers.indexOf('State')] || row[4],
      metro: row[headers.indexOf('Metro')] || null,
      date: latestDate,
      heat_index: Math.round(val),
    });
  }

  const count = await batchUpsert(supabase, 'zip_heat_index', zipRows, 'zip_code,date');
  return { zips: zipRows.length, rows: count, latestDate };
}

// ─── Route handler ───────────────────────────────────────────────

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const results: Record<string, unknown> = {};
  const errors: string[] = [];
  const startTime = Date.now();

  try {
    results.metro = await seedMetroData(supabase);
  } catch (e) {
    errors.push(`Metro: ${(e as Error).message}`);
  }

  try {
    results.county = await seedCountyData(supabase);
  } catch (e) {
    errors.push(`County: ${(e as Error).message}`);
  }

  try {
    results.zip = await seedZipData(supabase);
  } catch (e) {
    errors.push(`ZIP: ${(e as Error).message}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const summary = {
    success: errors.length === 0,
    elapsed: `${elapsed}s`,
    results,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  };

  // Log so it appears in Vercel logs
  console.log('[CRON] Data refresh complete:', JSON.stringify(summary, null, 2));

  return NextResponse.json(summary);
}
