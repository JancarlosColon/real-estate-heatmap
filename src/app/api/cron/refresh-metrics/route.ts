import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Separate cron for additional metrics (ZHVI, ZORI, etc.)
// Runs after /api/cron/refresh-data completes

const ZILLOW_CDN = 'https://files.zillowstatic.com/research/public_csvs';
const BATCH_SIZE = 200;
const MAX_RETRIES = 3;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

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

const METRICS = [
  { key: 'zhvi', county: `${ZILLOW_CDN}/zhvi/County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`, zip: `${ZILLOW_CDN}/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv` },
  { key: 'zori', county: `${ZILLOW_CDN}/zori/County_zori_uc_sfrcondomfr_sm_month.csv`, zip: `${ZILLOW_CDN}/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv` },
  { key: 'sale_to_list', county: `${ZILLOW_CDN}/mean_sale_to_list/County_mean_sale_to_list_uc_sfrcondo_sm_month.csv`, zip: `${ZILLOW_CDN}/mean_sale_to_list/Zip_mean_sale_to_list_uc_sfrcondo_sm_month.csv` },
  { key: 'median_list_price', county: `${ZILLOW_CDN}/mlp/County_mlp_uc_sfrcondo_month.csv`, zip: `${ZILLOW_CDN}/mlp/Zip_mlp_uc_sfrcondo_month.csv` },
  { key: 'median_sale_price', county: `${ZILLOW_CDN}/median_sale_price/County_median_sale_price_uc_sfrcondo_month.csv`, zip: `${ZILLOW_CDN}/median_sale_price/Zip_median_sale_price_uc_sfrcondo_month.csv` },
  { key: 'price_cuts', county: `${ZILLOW_CDN}/perc_listings_price_cut/County_perc_listings_price_cut_uc_sfrcondo_week.csv`, zip: `${ZILLOW_CDN}/perc_listings_price_cut/Zip_perc_listings_price_cut_uc_sfrcondo_week.csv` },
  { key: 'new_listings', county: `${ZILLOW_CDN}/new_listings/County_new_listings_uc_sfrcondo_week.csv`, zip: `${ZILLOW_CDN}/new_listings/Zip_new_listings_uc_sfrcondo_week.csv` },
  { key: 'inventory', county: `${ZILLOW_CDN}/invt_fs/County_invt_fs_uc_sfrcondo_week.csv`, zip: `${ZILLOW_CDN}/invt_fs/Zip_invt_fs_uc_sfrcondo_week.csv` },
];

async function seedMetric(supabase: AnySupabase, metric: typeof METRICS[0], level: 'county' | 'zip') {
  const url = level === 'county' ? metric.county : metric.zip;
  const table = level === 'county' ? 'county_metrics' : 'zip_metrics';
  const label = `${level}/${metric.key}`;

  console.log(`[CRON-METRICS] ${label}: Fetching CSV...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label} fetch failed: ${res.status}`);

  const { headers, rows, dateColumns } = parseCSV(await res.text());
  const latestDate = dateColumns[dateColumns.length - 1];
  const latestIdx = headers.indexOf(latestDate);
  const stateIdx = headers.indexOf('State') !== -1 ? headers.indexOf('State') : 4;
  const metroIdx = headers.indexOf('Metro');

  console.log(`[CRON-METRICS] ${label}: Parsed ${rows.length} rows, latest: ${latestDate}`);

  const dbRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const val = parseFloat(row[latestIdx]);
    if (isNaN(val)) continue;

    if (level === 'county') {
      const sf = (row[headers.indexOf('StateCodeFIPS')] || '').padStart(2, '0');
      const cf = (row[headers.indexOf('MunicipalCodeFIPS')] || '').padStart(3, '0');
      dbRows.push({
        fips: sf + cf, county_name: row[2], state_code: row[stateIdx],
        metro: metroIdx >= 0 ? row[metroIdx] || null : null,
        metric: metric.key, date: latestDate, value: val,
      });
    } else {
      const cityIdx = headers.indexOf('City');
      const countyIdx = headers.indexOf('CountyName');
      dbRows.push({
        zip_code: row[2], city: cityIdx >= 0 ? row[cityIdx] || null : null,
        county_name: countyIdx >= 0 ? row[countyIdx] || null : null,
        state_code: row[stateIdx], metro: metroIdx >= 0 ? row[metroIdx] || null : null,
        metric: metric.key, date: latestDate, value: val,
      });
    }
  }

  const conflictKey = level === 'county' ? 'fips,metric,date' : 'zip_code,metric,date';
  console.log(`[CRON-METRICS] ${label}: Upserting ${dbRows.length} rows...`);
  const count = await batchUpsert(supabase, table, dbRows, conflictKey);
  console.log(`[CRON-METRICS] ${label}: ✓ ${count} rows`);
  return { rows: count, latestDate };
}

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[CRON-METRICS] ╔══════════════════════════════════════╗');
  console.log('[CRON-METRICS] ║  Additional Metrics Refresh Started   ║');
  console.log('[CRON-METRICS] ╚══════════════════════════════════════╝');

  const supabase = getSupabase();
  const results: Record<string, unknown> = {};
  const errors: string[] = [];
  const startTime = Date.now();

  for (const metric of METRICS) {
    for (const level of ['county', 'zip'] as const) {
      const label = `${level}/${metric.key}`;
      try {
        results[label] = await seedMetric(supabase, metric, level);
      } catch (e) {
        console.error(`[CRON-METRICS] ✗ ${label} FAILED:`, (e as Error).message);
        errors.push(`${label}: ${(e as Error).message}`);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const summary = {
    success: errors.length === 0,
    elapsed: `${elapsed}s`,
    results,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  };

  console.log('[CRON-METRICS] Complete:', JSON.stringify(summary, null, 2));
  return NextResponse.json(summary);
}
