import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://SUPABASE_PROJECT_ID.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sql = `
-- County heat index data
CREATE TABLE IF NOT EXISTS county_heat_index (
  fips TEXT NOT NULL,
  county_name TEXT NOT NULL,
  state_code TEXT NOT NULL,
  metro TEXT,
  date DATE NOT NULL,
  heat_index REAL,
  PRIMARY KEY (fips, date)
);

-- ZIP code heat index data
CREATE TABLE IF NOT EXISTS zip_heat_index (
  zip_code TEXT NOT NULL,
  city TEXT,
  county_name TEXT,
  state_code TEXT NOT NULL,
  metro TEXT,
  date DATE NOT NULL,
  heat_index REAL,
  PRIMARY KEY (zip_code, date)
);

-- ZIP centroid coordinates
CREATE TABLE IF NOT EXISTS zip_centroids (
  zip_code TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_county_heat_state_date ON county_heat_index (state_code, date);
CREATE INDEX IF NOT EXISTS idx_zip_heat_county_date ON zip_heat_index (county_name, state_code, date);

-- RLS
ALTER TABLE county_heat_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE zip_heat_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE zip_centroids ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'county_heat_index' AND policyname = 'Allow public read county_heat_index') THEN
    CREATE POLICY "Allow public read county_heat_index" ON county_heat_index FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zip_heat_index' AND policyname = 'Allow public read zip_heat_index') THEN
    CREATE POLICY "Allow public read zip_heat_index" ON zip_heat_index FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zip_centroids' AND policyname = 'Allow public read zip_centroids') THEN
    CREATE POLICY "Allow public read zip_centroids" ON zip_centroids FOR SELECT USING (true);
  END IF;
END $$;
`;

async function run() {
  // Split into individual statements and run each
  const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0);
  
  for (const stmt of statements) {
    const { error } = await supabase.rpc("exec_sql", { sql_string: stmt + ";" });
    if (error) {
      // If exec_sql doesn't exist, we'll need another approach
      console.error("RPC error:", error.message);
      break;
    }
  }
  
  // Verify
  const { data, error } = await supabase.from("county_heat_index").select("fips").limit(1);
  if (error) {
    console.log("Table not created yet:", error.message);
    console.log("\n⚠️  Please run this SQL in the Supabase Dashboard SQL Editor:");
    console.log("   Dashboard → SQL Editor → New Query → Paste & Run\n");
    console.log(sql);
  } else {
    console.log("✓ Tables created successfully");
  }
}

run();
