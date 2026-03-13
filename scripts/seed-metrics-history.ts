import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey);
const BATCH_SIZE = 500;
const CDN = "https://files.zillowstatic.com/research/public_csvs";

interface MetricDef {
  key: string;
  label: string;
  countyUrl: string;
  zipUrl: string;
  frequency: "monthly" | "weekly";
}

const METRICS: MetricDef[] = [
  {
    key: "zhvi", label: "Home Value (ZHVI)",
    countyUrl: `${CDN}/zhvi/County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    zipUrl: `${CDN}/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    frequency: "monthly",
  },
  {
    key: "zori", label: "Rent Index (ZORI)",
    countyUrl: `${CDN}/zori/County_zori_uc_sfrcondomfr_sm_month.csv`,
    zipUrl: `${CDN}/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv`,
    frequency: "monthly",
  },
  {
    key: "sale_to_list", label: "Sale-to-List Ratio",
    countyUrl: `${CDN}/mean_sale_to_list/County_mean_sale_to_list_uc_sfrcondo_sm_month.csv`,
    zipUrl: `${CDN}/mean_sale_to_list/Zip_mean_sale_to_list_uc_sfrcondo_sm_month.csv`,
    frequency: "monthly",
  },
  {
    key: "median_list_price", label: "Median List Price",
    countyUrl: `${CDN}/mlp/County_mlp_uc_sfrcondo_month.csv`,
    zipUrl: `${CDN}/mlp/Zip_mlp_uc_sfrcondo_month.csv`,
    frequency: "monthly",
  },
  {
    key: "median_sale_price", label: "Median Sale Price",
    countyUrl: `${CDN}/median_sale_price/County_median_sale_price_uc_sfrcondo_month.csv`,
    zipUrl: `${CDN}/median_sale_price/Zip_median_sale_price_uc_sfrcondo_month.csv`,
    frequency: "monthly",
  },
  {
    key: "price_cuts", label: "Price Cuts %",
    countyUrl: `${CDN}/perc_listings_price_cut/County_perc_listings_price_cut_uc_sfrcondo_week.csv`,
    zipUrl: `${CDN}/perc_listings_price_cut/Zip_perc_listings_price_cut_uc_sfrcondo_week.csv`,
    frequency: "weekly",
  },
  {
    key: "new_listings", label: "New Listings",
    countyUrl: `${CDN}/new_listings/County_new_listings_uc_sfrcondo_week.csv`,
    zipUrl: `${CDN}/new_listings/Zip_new_listings_uc_sfrcondo_week.csv`,
    frequency: "weekly",
  },
  {
    key: "inventory", label: "Inventory",
    countyUrl: `${CDN}/invt_fs/County_invt_fs_uc_sfrcondo_week.csv`,
    zipUrl: `${CDN}/invt_fs/Zip_invt_fs_uc_sfrcondo_week.csv`,
    frequency: "weekly",
  },
];

// For weekly metrics, only keep monthly snapshots (1st of each month or closest)
// For time period offsets we need: latest, -2mo, -5mo, -11mo, -35mo, -59mo
// That's about 60 months back. Let's keep one date per month for last 60 months.

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
    else current += char;
  }
  values.push(current.trim());
  return values;
}

function parseCSV(text: string) {
  const lines = text.trim().split("\n");
  const headers = parseCsvLine(lines[0]);
  const dateColumns = headers.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h));
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length >= 5) rows.push(values);
  }
  return { headers, rows, dateColumns };
}

// Pick one date per month from the list (the last date in each month)
function pickMonthlyDates(dates: string[]): string[] {
  const byMonth = new Map<string, string>();
  for (const d of dates) {
    const month = d.slice(0, 7); // "2024-01"
    byMonth.set(month, d); // last one wins
  }
  return [...byMonth.values()].sort();
}

async function batchUpsert(
  table: string,
  rows: Record<string, unknown>[],
  conflictKey: string,
  label: string
) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    let retries = 3;
    while (retries > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(table) as any).upsert(batch, { onConflict: conflictKey });
      if (!error) break;
      retries--;
      if (retries === 0) { console.error(`\n  Error: ${error.message}`); return inserted; }
      await new Promise((r) => setTimeout(r, 1000));
    }
    inserted += batch.length;
    if (inserted % 5000 === 0 || inserted === rows.length) {
      process.stdout.write(`  ${label}: ${inserted.toLocaleString()}/${rows.length.toLocaleString()}\r`);
    }
  }
  console.log(`  ${label}: ${inserted.toLocaleString()} ✓`);
  return inserted;
}

async function seedMetric(metric: MetricDef, geo: "county" | "zip") {
  const url = geo === "county" ? metric.countyUrl : metric.zipUrl;
  const table = geo === "county" ? "county_metrics" : "zip_metrics";

  console.log(`\n  Fetching ${geo} ${metric.key}...`);
  const res = await fetch(url);
  if (!res.ok) { console.error(`  Failed: ${res.status}`); return; }

  const { headers, rows, dateColumns } = parseCSV(await res.text());
  
  // For weekly data, pick one per month. For monthly, use all.
  const datesToSeed = metric.frequency === "weekly" 
    ? pickMonthlyDates(dateColumns)
    : dateColumns;
  
  // Keep last 60 months
  const recentDates = datesToSeed.slice(-60);
  
  console.log(`  Parsed ${rows.length} regions, ${dateColumns.length} total dates → seeding ${recentDates.length} monthly dates`);

  const dbRows: Record<string, unknown>[] = [];

  for (const date of recentDates) {
    const dateIdx = headers.indexOf(date);
    if (dateIdx < 0) continue;

    if (geo === "county") {
      const stateCodeIdx = headers.indexOf("StateCodeFIPS");
      const countyCodeIdx = headers.indexOf("MunicipalCodeFIPS");
      const stateIdx = headers.indexOf("State") !== -1 ? headers.indexOf("State") : 4;
      const metroIdx = headers.indexOf("Metro");

      for (const row of rows) {
        const val = parseFloat(row[dateIdx]);
        if (isNaN(val)) continue;
        const stateFips = (row[stateCodeIdx] || "").padStart(2, "0");
        const countyFips = (row[countyCodeIdx] || "").padStart(3, "0");
        dbRows.push({
          fips: stateFips + countyFips,
          county_name: row[2],
          state_code: row[stateIdx],
          metro: metroIdx >= 0 ? row[metroIdx] || null : null,
          metric: metric.key,
          date,
          value: val,
        });
      }
    } else {
      const stateIdx = headers.indexOf("State") !== -1 ? headers.indexOf("State") : 4;
      const cityIdx = headers.indexOf("City");
      const countyIdx = headers.indexOf("CountyName");
      const metroIdx = headers.indexOf("Metro");

      for (const row of rows) {
        const val = parseFloat(row[dateIdx]);
        if (isNaN(val)) continue;
        dbRows.push({
          zip_code: row[2],
          city: cityIdx >= 0 ? row[cityIdx] || null : null,
          county_name: countyIdx >= 0 ? row[countyIdx] || null : null,
          state_code: row[stateIdx],
          metro: metroIdx >= 0 ? row[metroIdx] || null : null,
          metric: metric.key,
          date,
          value: val,
        });
      }
    }
  }

  console.log(`  Total rows to upsert: ${dbRows.length.toLocaleString()}`);
  const conflictKey = geo === "county" ? "fips,metric,date" : "zip_code,metric,date";
  await batchUpsert(table, dbRows, conflictKey, `${geo}/${metric.key}`);
}

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║  Zillow Metrics History Seeder (60 months)    ║");
  console.log("╚═══════════════════════════════════════════════╝");

  const startTime = Date.now();
  const onlyMetric = process.argv[2];
  const onlyGeo = process.argv[3] as "county" | "zip" | undefined;

  for (const metric of METRICS) {
    if (onlyMetric && metric.key !== onlyMetric) continue;

    console.log(`\n═══ ${metric.label} (${metric.key}) ═══`);
    if (!onlyGeo || onlyGeo === "county") await seedMetric(metric, "county");
    if (!onlyGeo || onlyGeo === "zip") await seedMetric(metric, "zip");
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✓ All done in ${elapsed}s`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
