-- Monthly GPS distance per vehicle (independent of fuel logs).
-- One row per (vehicle, month); the current month's row is upserted on each sync,
-- past months stay as frozen history.
create table if not exists public.vehicle_gps_distance (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  year_month  text not null,                 -- 'YYYY-MM'
  distance_km numeric not null default 0,
  synced_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (vehicle_id, year_month)
);

create index if not exists idx_gps_distance_vehicle on public.vehicle_gps_distance(vehicle_id);
create index if not exists idx_gps_distance_month   on public.vehicle_gps_distance(year_month);
