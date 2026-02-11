# Real Estate Heatmap

## Project Overview
Interactive 3D globe application for visualizing US real estate market data. Users can spin/zoom the globe and see states colored by market heat indicators (price growth, demand, days on market, etc.).

## Tech Stack
- **Frontend**: Next.js 14+ (App Router) with TypeScript
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
```

## Project Structure
```
/app
  /api           # API routes
  /components    # React components
  /hooks         # Custom hooks
  /lib           # Utilities, Supabase client
  /types         # TypeScript types
/public
  /data          # GeoJSON, static data
```

## Key Patterns
- Server Components by default, Client Components for interactivity
- Supabase client initialized in /lib/supabase.ts
- Mapbox styles and tokens via environment variables

## Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## External Services
- **Mapbox**: 3D globe rendering, GeoJSON layers for state boundaries
- **Supabase**: Real estate metrics storage and queries

## Data Model
- `state_metrics`: state_code, price_growth, median_price, days_on_market, demand_index, updated_at

## Notes
- Use Mapbox `globe` projection for 3D effect
- Color states using choropleth based on selected metric
- Consider data sources: Zillow, Redfin, Census, Realtor.com APIs
