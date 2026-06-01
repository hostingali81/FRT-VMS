# FRT Vehicle Management System

Web-based multi-circle FRT vehicle management for The Imperial Electric Company.

## Stack

- Next.js 14 App Router
- Tailwind CSS
- Supabase PostgreSQL, Auth, RLS, Storage
- Recharts, Lucide, XLSX export

## Local Run

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

The app has demo fallback data, so it runs even before Supabase keys are added.

## Supabase Setup

Project URL:

```env
NEXT_PUBLIC_SUPABASE_URL=https://basfgceiklbzcjdfbmij.supabase.co
```

Add these keys in `.env.local` from Supabase Dashboard -> Project Settings -> API:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Apply database migrations after the CLI account has access to the project:

```bash
npx supabase login
npx supabase link --project-ref basfgceiklbzcjdfbmij --password YOUR_DB_PASSWORD
npx supabase db push
```

The migrations create hierarchy tables, vehicle/driver masters, current assignments, append-only histories, document storage bucket, RLS helper policies, dashboard views, RPC transfer/status functions, and Barabanki seed data.

## Verification

```bash
npm run lint
npm run build
```

