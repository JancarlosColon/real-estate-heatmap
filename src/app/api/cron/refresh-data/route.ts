import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This route is triggered by Vercel Cron on the 17th of each month
// Zillow publishes new data on the 16th

const ZILLOW_CDN = 'https://files.zillowstatic.com/research/public_csvs';
const CENTROIDS_URL =
  'https://gist.githubusercontent.com/erichurst/7882666/raw/5bdc46db47d9515269ab12ed6fb2850377fd869e/US%20Zip%20Codes%20from%202013%20Government%20Data';
const BATCH_SIZE = 200;
const MAX_RETRIES = 3;

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
  if (!cronSecret) return true; // no secret configured = allow (dev mode)
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

// ─── Seed functions ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

async function seedMetroData(supabase: AnySupabase) {
  const res = await fetch(
    `${ZILLOW_CDN}/market_temp_index/Metro_market_temp_index_uc_sfrcondo_month.csv`
  );
  if (!res.ok) throw new Error(`Metro CSV fetch failed: ${res.status}`);
  const text = await res.text();
  const { headers, rows, dateColumns } = parseCSV(text);

  // Upsert metro_regions
  const regions = rows.map((row) => ({
    region_id: parseInt(row[0]),
    size_rank: parseInt(row[1]) || 999,
    region_name: row[2],
    region_type: row[3],
    state_code: row[4] || null,
  }));
  await batchUpsert(supabase, 'metro_regions', regions, 'region_id');

  // Upsert heat index values
  const heatRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    for (const date of dateColumns) {
      const val = parseFloat(row[headers.indexOf(date)]);
      if (!isNaN(val)) {
        heatRows.push({ region_id: parseInt(row[0]), date, heat_value: val });
      }
    }
  }
  const count = await batchUpsert(supabase, 'metro_market_temp_index', heatRows, 'region_id,date');

  // Refresh materialized view
  try { await supabase.rpc('refresh_state_heat_summary'); } catch { /* may not exist */ }

  return { metros: regions.length, heatRows: count };
}

async function seedCountyData(supabase: AnySupabase) {
  const res = await fetch(
    `${ZILLOW_CDN}/market_temp_index/County_market_temp_index_uc_sfrcondo_month.csv`
  );
  if (!res.ok) throw new Error(`County CSV fetch failed: ${res.status}`);
  const text = await res.text();
  const { headers, rows, dateColumns } = parseCSV(text);

  const countyRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const stateFips = (row[headers.indexOf('StateCodeFIPS')] || '').padStart(2, '0');
    const countyFips = (row[headers.indexOf('MunicipalCodeFIPS')] || '').padStart(3, '0');
    const fips = stateFips + countyFips;
    const countyName = row[2];
    const stateCode = row[headers.indexOf('State')] || row[4];
    const metro = row[headers.indexOf('Metro')] || null;

    for (const date of dateColumns) {
      const val = parseFloat(row[headers.indexOf(date)]);
      if (!isNaN(val)) {
        countyRows.push({ fips, county_name: countyName, state_code: stateCode, metro, date, heat_index: Math.round(val) });
      }
    }
  }

  const count = await batchUpsert(supabase, 'county_heat_index', countyRows, 'fips,date');
  return { counties: rows.length, rows: count };
}

async function seedZipData(supabase: AnySupabase) {
  const res = await fetch(
    `${ZILLOW_CDN}/market_temp_index/Zip_market_temp_index_uc_sfrcondo_month.csv`
  );
  if (!res.ok) throw new Error(`ZIP CSV fetch failed: ${res.status}`);
  const text = await res.text();
  const { headers, rows, dateColumns } = parseCSV(text);

  const zipRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const zipCode = row[2];
    const stateCode = row[headers.indexOf('State')] || row[4];
    const city = row[headers.indexOf('City')] || null;
    const countyName = row[headers.indexOf('CountyName')] || null;
    const metro = row[headers.indexOf('Metro')] || null;

    for (const date of dateColumns) {
      const val = parseFloat(row[headers.indexOf(date)]);
      if (!isNaN(val)) {
        zipRows.push({ zip_code: zipCode, city, county_name: countyName, state_code: stateCode, metro, date, heat_index: Math.round(val) });
      }
    }
  }

  const count = await batchUpsert(supabase, 'zip_heat_index', zipRows, 'zip_code,date');
  return { zips: rows.length, rows: count };
}

async function seedCentroids(supabase: AnySupabase) {
  const res = await fetch(CENTROIDS_URL);
  if (!res.ok) throw new Error(`Centroids fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n');

  const centroids: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 3) {
      centroids.push({ zip_code: parts[0].trim(), lat: parseFloat(parts[1]), lng: parseFloat(parts[2]) });
    }
  }

  const count = await batchUpsert(supabase, 'zip_centroids', centroids, 'zip_code');
  return { centroids: count };
}

// ─── Route handler ───────────────────────────────────────────────

export const maxDuration = 300; // 5 min (Vercel Pro) — ZIP data takes a while

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const results: Record<string, unknown> = {};
  const errors: string[] = [];
  const startTime = Date.now();

  // Seed each dataset independently so partial failures don't block others
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

  try {
    results.centroids = await seedCentroids(supabase);
  } catch (e) {
    errors.push(`Centroids: ${(e as Error).message}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  return NextResponse.json({
    success: errors.length === 0,
    elapsed: `${elapsed}s`,
    results,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  });
}
