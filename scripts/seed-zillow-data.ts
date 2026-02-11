import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === "your_service_role_key_here") {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  console.error("Get your service role key from: Supabase Dashboard > Settings > API");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface CsvRow {
  regionId: number;
  sizeRank: number;
  regionName: string;
  regionType: string;
  stateName: string;
  values: Record<string, number>;
}

function parseCSV(filePath: string): { rows: CsvRow[]; dateColumns: string[] } {
  const text = readFileSync(filePath, "utf-8");
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");

  const dateColumns = headers.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h));
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Parse CSV handling quoted values
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);

    const valueMap: Record<string, number> = {};
    for (const dateCol of dateColumns) {
      const idx = headers.indexOf(dateCol);
      const val = parseFloat(values[idx]);
      if (!isNaN(val)) {
        valueMap[dateCol] = val;
      }
    }

    rows.push({
      regionId: parseInt(values[0]),
      sizeRank: parseInt(values[1]) || 999,
      regionName: values[2],
      regionType: values[3],
      stateName: values[4],
      values: valueMap,
    });
  }

  return { rows, dateColumns };
}

async function seed() {
  const csvPath = resolve(__dirname, "../public/data/Metro_market_temp_index_uc_sfrcondo_month.csv");
  console.log(`Reading CSV from ${csvPath}`);

  const { rows, dateColumns } = parseCSV(csvPath);
  console.log(`Parsed ${rows.length} rows with ${dateColumns.length} date columns`);

  // Step 1: Insert metro regions
  console.log("\nInserting metro regions...");
  const regionBatches: { region_id: number; size_rank: number; region_name: string; region_type: string; state_code: string | null }[] = [];

  for (const row of rows) {
    regionBatches.push({
      region_id: row.regionId,
      size_rank: row.sizeRank,
      region_name: row.regionName,
      region_type: row.regionType,
      state_code: row.stateName || null,
    });
  }

  // Batch upsert metro_regions in chunks of 500
  const REGION_BATCH_SIZE = 500;
  for (let i = 0; i < regionBatches.length; i += REGION_BATCH_SIZE) {
    const batch = regionBatches.slice(i, i + REGION_BATCH_SIZE);
    const { error } = await supabase
      .from("metro_regions")
      .upsert(batch, { onConflict: "region_id" });

    if (error) {
      console.error(`Error inserting metro_regions batch ${i / REGION_BATCH_SIZE + 1}:`, error.message);
      process.exit(1);
    }
    process.stdout.write(`  Inserted ${Math.min(i + REGION_BATCH_SIZE, regionBatches.length)}/${regionBatches.length} regions\r`);
  }
  console.log(`\n  Done: ${regionBatches.length} metro regions inserted`);

  // Step 2: Insert heat index values (normalized)
  console.log("\nInserting heat index values...");
  let totalInserted = 0;
  const HEAT_BATCH_SIZE = 500;
  let heatBatch: { region_id: number; date: string; heat_value: number }[] = [];

  for (const row of rows) {
    for (const [date, value] of Object.entries(row.values)) {
      heatBatch.push({
        region_id: row.regionId,
        date,
        heat_value: value,
      });

      if (heatBatch.length >= HEAT_BATCH_SIZE) {
        const { error } = await supabase
          .from("metro_market_temp_index")
          .upsert(heatBatch, { onConflict: "region_id,date" });

        if (error) {
          console.error(`Error inserting heat data batch:`, error.message);
          process.exit(1);
        }

        totalInserted += heatBatch.length;
        process.stdout.write(`  Inserted ${totalInserted} heat index rows\r`);
        heatBatch = [];
      }
    }
  }

  // Insert remaining batch
  if (heatBatch.length > 0) {
    const { error } = await supabase
      .from("metro_market_temp_index")
      .upsert(heatBatch, { onConflict: "region_id,date" });

    if (error) {
      console.error(`Error inserting final heat data batch:`, error.message);
      process.exit(1);
    }
    totalInserted += heatBatch.length;
  }
  console.log(`\n  Done: ${totalInserted} heat index rows inserted`);

  // Step 3: Refresh materialized view
  console.log("\nRefreshing state_heat_summary materialized view...");
  const { error: refreshError } = await supabase.rpc("refresh_state_heat_summary");

  if (refreshError) {
    // Fallback: try raw SQL
    console.log("  RPC not found, using raw SQL refresh...");
    const { error: sqlError } = await supabase.from("state_heat_summary").select("state_code").limit(1);
    if (sqlError) {
      console.warn("  Warning: Could not verify materialized view. You may need to refresh it manually:");
      console.warn("  REFRESH MATERIALIZED VIEW CONCURRENTLY state_heat_summary;");
    }
  }

  console.log("\nSeed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
