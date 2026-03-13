-- County heat index data (from Zillow CDN)
CREATE TABLE IF NOT EXISTS county_heat_index (
  fips TEXT NOT NULL,           -- 5-digit FIPS code (e.g., "06037")
  county_name TEXT NOT NULL,
  state_code TEXT NOT NULL,     -- 2-letter state code
  metro TEXT,
  date DATE NOT NULL,
  heat_index REAL,
  PRIMARY KEY (fips, date)
);

-- ZIP code heat index data (from Zillow CDN)
CREATE TABLE IF NOT EXISTS zip_heat_index (
  zip_code TEXT NOT NULL,       -- 5-digit ZIP code
  city TEXT,
  county_name TEXT,
  state_code TEXT NOT NULL,
  metro TEXT,
  date DATE NOT NULL,
  heat_index REAL,
  PRIMARY KEY (zip_code, date)
);

-- ZIP centroid coordinates (for map rendering)
CREATE TABLE IF NOT EXISTS zip_centroids (
  zip_code TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_county_heat_state_date ON county_heat_index (state_code, date);
CREATE INDEX IF NOT EXISTS idx_zip_heat_county_date ON zip_heat_index (county_name, state_code, date);
CREATE INDEX IF NOT EXISTS idx_zip_heat_state_date ON zip_heat_index (state_code, date);

-- RLS policies (read-only for anon)
ALTER TABLE county_heat_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE zip_heat_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE zip_centroids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read county_heat_index" ON county_heat_index
  FOR SELECT USING (true);

CREATE POLICY "Allow public read zip_heat_index" ON zip_heat_index
  FOR SELECT USING (true);

CREATE POLICY "Allow public read zip_centroids" ON zip_centroids
  FOR SELECT USING (true);
