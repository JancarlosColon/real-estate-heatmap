# Real Estate Heatmap

## Project Overview
Interactive 3D globe application for visualizing US real estate market conditions using Zillow's Market Heat Index. Users can spin/zoom the globe, see states colored by heat index, select time periods (30d–5y), and click states for metro-level breakdowns with change indicators.

## Tech Stack
- **Frontend**: Next.js 16 (App Router) with TypeScript
- **Maps**: Mapbox GL JS (3D globe projection)
- **Backend**: Next.js API routes
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel
- **UI**: React components, Tailwind CSS

## Commands
```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
npm run start    # Start production server

# Seed database from CSV (requires SUPABASE_SERVICE_ROLE_KEY in .env.local)
npx tsx --env-file=.env.local scripts/seed-zillow-data.ts
```

## Project Structure
```
/src/app
  /api/heat-data   # API route: state heat data by time period
  /components      # Globe, StateInfoPanel, Legend, MetricSelector
  /hooks           # Custom hooks
  /lib             # supabase.ts client, metrics-config.ts
  /types           # TypeScript interfaces (StateMetric, MetroMetric, TimePeriod)
/scripts
  seed-zillow-data.ts  # Seed script: CSV → Supabase (upserts regions + heat index rows, refreshes materialized view)
```

## Key Patterns
- Server Components by default, Client Components (`'use client'`) for interactivity
- Supabase client initialized in `/lib/supabase.ts` (uses anon key, read-only)
- API route `/api/heat-data?period=30d` fetches from Supabase `state_heat_summary` materialized view
- Time periods use offset-based date lookup (30d=0, 90d=2, 6m=5, 1y=11, 3y=35, 5y=59 months back)
- Change indicators: when period != 30d, API computes `change = current_30d_value - historical_value` for state and metro levels
- Globe hover tooltip and StateInfoPanel show `→ XX now` with color coding (green = heated up, red = cooled down)
- Mapbox GeoJSON states matched by `state_name` (not FIPS code)

## Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # Only needed for seed script, never exposed to client
```

## Database Schema (Supabase)
- **`us_states`** — 51 rows (50 states + DC), reference table
- **`metro_regions`** — ~928 metro areas with state_code, sizeRank
- **`metro_market_temp_index`** — Fact table: (region_id, date) → heat_index (~86K rows)
- **`state_heat_summary`** — Materialized view: pre-aggregated state averages using weighted formula `1/sqrt(sizeRank)`, ~4800 rows
- RLS enabled on all tables (read-only policies), write grants revoked for anon/authenticated roles

## Supabase Gotchas
- Default 1000-row limit on queries — the API route queries dates from a single state (CA, 96 rows) to avoid truncation
- Materialized view needs `REFRESH MATERIALIZED VIEW state_heat_summary` after new data is seeded
- Seed script handles this automatically

## External Services
- **Mapbox**: 3D globe rendering, GeoJSON layers for state boundaries (dark-v11 style)
- **Supabase**: PostgreSQL database, project ID `SUPABASE_PROJECT_ID` (us-east-1)
- **Vercel**: Hosting with analytics

## Data Source
- Zillow Market Heat Index (monthly CSV: `Metro_market_temp_index_uc_sfrcondo_month.csv`)
- New data available monthly; run seed script to ingest and refresh materialized view
