import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === "your_service_role_key_here") {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  console.error("Get your service role key from: Supabase Dashboard > Settings > API");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const ZILLOW_CDN = "https://files.zillowstatic.com/research/public_csvs";
const BATCH_SIZE = 200;

// ─── CSV Parser ───────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

interface ParsedCSV {
  headers: string[];
  rows: string[][];
  dateColumns: string[];
}

function parseCSV(text: string): ParsedCSV {
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

// ─── Fetch from Zillow CDN ───────────────────────────────────────

async function fetchCSV(url: string): Promise<string> {
  console.log(`  Fetching ${url.split("/").pop()}...`);
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RealEstateHeatmap/1.0)" },
  });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
  return res.text();
}

// ─── Batch upsert helper ─────────────────────────────────────────

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
      try {
        const { error } = await supabase.from(table).upsert(batch, { onConflict: conflictKey });
        if (error) {
          throw new Error(error.message);
        }
        break;
      } catch (err) {
        retries--;
        if (retries === 0) {
          console.error(`\n  Error upserting ${table} batch after 3 retries:`, (err as Error).message);
          process.exit(1);
        }
        console.warn(`\n  Retry (${3 - retries}/3) for ${table} batch at ${i}...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    inserted += batch.length;
    process.stdout.write(`  ${label}: ${inserted}/${rows.length}\r`);
  }
  console.log(`  ${label}: ${inserted}/${rows.length} ✓`);
}

// ─── Seed County Data ────────────────────────────────────────────

async function seedCountyData() {
  console.log("\n═══ Seeding County Heat Index ═══");

  const text = await fetchCSV(`${ZILLOW_CDN}/market_temp_index/County_market_temp_index_uc_sfrcondo_month.csv`);
  const { headers, rows, dateColumns } = parseCSV(text);

  console.log(`  Parsed ${rows.length} counties, ${dateColumns.length} dates`);
  console.log(`  Date range: ${dateColumns[0]} → ${dateColumns[dateColumns.length - 1]}`);

  // Build flat rows: one per (county, date)
  const countyRows: Record<string, unknown>[] = [];

  for (const row of rows) {
    const stateFips = (row[headers.indexOf("StateCodeFIPS")] || "").padStart(2, "0");
    const countyFips = (row[headers.indexOf("MunicipalCodeFIPS")] || "").padStart(3, "0");
    const fips = stateFips + countyFips;
    const countyName = row[2]; // RegionName
    const stateCode = row[headers.indexOf("State")] || row[4]; // State or StateName
    const metro = row[headers.indexOf("Metro")] || null;

    for (const date of dateColumns) {
      const idx = headers.indexOf(date);
      const val = parseFloat(row[idx]);
      if (!isNaN(val)) {
        countyRows.push({
          fips,
          county_name: countyName,
          state_code: stateCode,
          metro,
          date,
          heat_index: Math.round(val),
        });
      }
    }
  }

  console.log(`  Total county rows to upsert: ${countyRows.length}`);
  await batchUpsert("county_heat_index", countyRows, "fips,date", "Counties");
}

// ─── Seed ZIP Data ───────────────────────────────────────────────

async function seedZipData() {
  console.log("\n═══ Seeding ZIP Heat Index ═══");

  const text = await fetchCSV(`${ZILLOW_CDN}/market_temp_index/Zip_market_temp_index_uc_sfrcondo_month.csv`);
  const { headers, rows, dateColumns } = parseCSV(text);

  console.log(`  Parsed ${rows.length} ZIPs, ${dateColumns.length} dates`);
  console.log(`  Date range: ${dateColumns[0]} → ${dateColumns[dateColumns.length - 1]}`);

  // Build flat rows: one per (zip, date)
  const zipRows: Record<string, unknown>[] = [];

  for (const row of rows) {
    const zipCode = row[2]; // RegionName = ZIP code
    const stateCode = row[headers.indexOf("State")] || row[4];
    const city = row[headers.indexOf("City")] || null;
    const countyName = row[headers.indexOf("CountyName")] || null;
    const metro = row[headers.indexOf("Metro")] || null;

    for (const date of dateColumns) {
      const idx = headers.indexOf(date);
      const val = parseFloat(row[idx]);
      if (!isNaN(val)) {
        zipRows.push({
          zip_code: zipCode,
          city,
          county_name: countyName,
          state_code: stateCode,
          metro,
          date,
          heat_index: Math.round(val),
        });
      }
    }
  }

  console.log(`  Total ZIP rows to upsert: ${zipRows.length}`);
  await batchUpsert("zip_heat_index", zipRows, "zip_code,date", "ZIPs");
}

// ─── Seed ZIP Centroids ──────────────────────────────────────────

async function seedZipCentroids() {
  console.log("\n═══ Seeding ZIP Centroids ═══");

  const text = await fetchCSV(
    "https://gist.githubusercontent.com/erichurst/7882666/raw/5bdc46db47d9515269ab12ed6fb2850377fd869e/US%20Zip%20Codes%20from%202013%20Government%20Data"
  );
  const lines = text.trim().split("\n");

  const centroids: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length >= 3) {
      const zip = parts[0].trim();
      const lat = parseFloat(parts[1].trim());
      const lng = parseFloat(parts[2].trim());
      if (!isNaN(lat) && !isNaN(lng)) {
        centroids.push({ zip_code: zip, lat, lng });
      }
    }
  }

  console.log(`  Parsed ${centroids.length} ZIP centroids`);
  await batchUpsert("zip_centroids", centroids, "zip_code", "Centroids");
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Zillow County + ZIP Data Seeder         ║");
  console.log("║  Source: files.zillowstatic.com          ║");
  console.log("╚══════════════════════════════════════════╝");

  const startTime = Date.now();

  await seedCountyData();
  await seedZipData();
  await seedZipCentroids();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✓ All done in ${elapsed}s`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
