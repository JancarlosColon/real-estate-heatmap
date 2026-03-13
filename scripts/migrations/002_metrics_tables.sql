-- Unified metrics tables for all Zillow datasets (county + ZIP level)
-- Each row: one metric, one geography, one date, one value

CREATE TABLE IF NOT EXISTS county_metrics (
  fips TEXT NOT NULL,
  county_name TEXT NOT NULL,
  state_code TEXT NOT NULL,
  metro TEXT,
  metric TEXT NOT NULL,         -- e.g. 'zhvi', 'zori', 'sale_to_list', etc.
  date DATE NOT NULL,
  value REAL,
  PRIMARY KEY (fips, metric, date)
);

CREATE TABLE IF NOT EXISTS zip_metrics (
  zip_code TEXT NOT NULL,
  city TEXT,
  county_name TEXT,
  state_code TEXT NOT NULL,
  metro TEXT,
  metric TEXT NOT NULL,
  date DATE NOT NULL,
  value REAL,
  PRIMARY KEY (zip_code, metric, date)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_county_metrics_state ON county_metrics (state_code, metric, date);
CREATE INDEX IF NOT EXISTS idx_zip_metrics_county ON zip_metrics (county_name, state_code, metric, date);

-- RLS policies (read-only for anon)
ALTER TABLE county_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE zip_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read county_metrics" ON county_metrics FOR SELECT USING (true);
CREATE POLICY "Allow public read zip_metrics" ON zip_metrics FOR SELECT USING (true);
