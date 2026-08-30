-- 020_rls_gps_and_ownership_history.sql
-- Close an RLS gap on three tables that were created without it.
--
-- vehicle_gps_distance (014), vehicle_fuel_ownership_history (006) and
-- vehicle_driver_ownership_history (010) never had ROW LEVEL SECURITY enabled,
-- while Supabase's default schema grants leave `anon` and `authenticated` with
-- full SELECT/INSERT/UPDATE/DELETE on everything in `public`. Verified against
-- production: the browser-side anon key reads vehicle_gps_distance in full,
-- whereas an RLS-protected table (vehicle_fuel_logs) correctly returns [].
-- Since NEXT_PUBLIC_SUPABASE_ANON_KEY ships in the client bundle, anyone with
-- the site's JS could read — or overwrite — the GPS distance history that the
-- Fuel Dashboard and /api/public/fuel report mileage from.
--
-- Every app write to these tables goes through the service-role client
-- (lib/data.ts, lib/gps-distance.ts) or a SECURITY DEFINER RPC, both of which
-- bypass RLS — so enabling it changes nothing for the application. As in 011,
-- the authoritative permission checks stay in lib/permissions.ts; this is the
-- defence-in-depth layer.

-- ── 1. Enable RLS ───────────────────────────────────────────────────────────
alter table public.vehicle_gps_distance               enable row level security;
alter table public.vehicle_fuel_ownership_history     enable row level security;
alter table public.vehicle_driver_ownership_history   enable row level security;

-- ── 2. Read policies, scoped like vehicle_fuel_logs in 008 ──────────────────
-- An authenticated user sees a row only for a vehicle they can already access.
drop policy if exists "gps_distance_select" on public.vehicle_gps_distance;
create policy "gps_distance_select" on public.vehicle_gps_distance
for select to authenticated
using (
  exists (
    select 1 from public.vehicles v
    left join public.vehicle_assignments va on va.vehicle_id = v.id
    where v.id = vehicle_gps_distance.vehicle_id
      and (
        public.is_super_admin()
        or public.can_access_circle(v.circle_id)
        or public.can_access_circle(va.circle_id)
        or public.can_access_division(va.division_id)
      )
  )
);

drop policy if exists "fuel_ownership_history_select" on public.vehicle_fuel_ownership_history;
create policy "fuel_ownership_history_select" on public.vehicle_fuel_ownership_history
for select to authenticated
using (
  exists (
    select 1 from public.vehicles v
    left join public.vehicle_assignments va on va.vehicle_id = v.id
    where v.id = vehicle_fuel_ownership_history.vehicle_id
      and (
        public.is_super_admin()
        or public.can_access_circle(v.circle_id)
        or public.can_access_circle(va.circle_id)
        or public.can_access_division(va.division_id)
      )
  )
);

drop policy if exists "driver_ownership_history_select" on public.vehicle_driver_ownership_history;
create policy "driver_ownership_history_select" on public.vehicle_driver_ownership_history
for select to authenticated
using (
  exists (
    select 1 from public.vehicles v
    left join public.vehicle_assignments va on va.vehicle_id = v.id
    where v.id = vehicle_driver_ownership_history.vehicle_id
      and (
        public.is_super_admin()
        or public.can_access_circle(v.circle_id)
        or public.can_access_circle(va.circle_id)
        or public.can_access_division(va.division_id)
      )
  )
);

-- No INSERT/UPDATE/DELETE policies: with RLS on, that already denies every write
-- from anon and authenticated. The app writes as service_role, which bypasses RLS.

-- ── 3. Drop the write grants too (defence in depth) ─────────────────────────
-- RLS alone would block these, but there is no reason for the public key to hold
-- DELETE/TRUNCATE on fleet history in the first place.
revoke insert, update, delete, truncate on public.vehicle_gps_distance             from anon, authenticated;
revoke insert, update, delete, truncate on public.vehicle_fuel_ownership_history   from anon, authenticated;
revoke insert, update, delete, truncate on public.vehicle_driver_ownership_history from anon, authenticated;

-- anon keeps no access at all to these tables; authenticated reads through the
-- policies above.
revoke select on public.vehicle_gps_distance             from anon;
revoke select on public.vehicle_fuel_ownership_history   from anon;
revoke select on public.vehicle_driver_ownership_history from anon;
