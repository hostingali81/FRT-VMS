-- 021_ownership_history_backfill_and_repair.sql
--
-- Two related fixes for fuel/driver ownership, both consequences of the same
-- vehicle-edit overwrite bug (updateVehicleAction used `vehicleSchema.partial()`,
-- and Zod 4 keeps `.default()` alive through `.partial()` — so the columns the
-- edit form never submits were written back as their defaults on every save:
-- fuel_ownership='company', driver_ownership='company', status='active').
--
--   1. Backfill the missing open ownership-history rows. Only public.vehicles was
--      clobbered; the append-only history tables are written solely by the
--      change_vehicle_* RPCs, so an open history row is the only record of the
--      real value. But 43 of the 52 vehicles have no such row at all: they came in
--      through the 2026-06-08 bulk import, which bypassed createVehicleAction, and
--      011's backfill had already run by then. That leaves them with nothing to
--      restore from, and leaves their "Fuel Source Logs" / "Driver Source" tabs
--      empty. This gives every vehicle the baseline row the RPCs and the profile
--      tabs assume — same approach as 011, dated from the vehicle's creation.
--
--      NOTE: the baseline can only record what public.vehicles says TODAY. For a
--      vehicle whose flag was already flipped by the bug, that stores the flipped
--      value — there is no earlier record to recover. Spot-check company/vendor on
--      any vehicle edited before this fix shipped.
--
--   2. Re-sync the master columns from the open history row. A no-op when the two
--      already agree (verified: 0 vehicles drifted at the time of writing), but it
--      repairs anything the bug flips between now and the code fix going live, and
--      it is safe to re-run.

-- ── 1. Backfill missing baseline rows ───────────────────────────────────────
insert into public.vehicle_fuel_ownership_history (vehicle_id, ownership, from_date, changed_by, remarks)
select v.id,
       v.fuel_ownership,
       (v.created_at at time zone 'Asia/Kolkata')::date,
       'System',
       'Backfill - initial fuel source'
from public.vehicles v
where not exists (
  select 1 from public.vehicle_fuel_ownership_history h where h.vehicle_id = v.id
);

insert into public.vehicle_driver_ownership_history (vehicle_id, ownership, from_date, changed_by, remarks)
select v.id,
       v.driver_ownership,
       (v.created_at at time zone 'Asia/Kolkata')::date,
       'System',
       'Backfill - initial driver source'
from public.vehicles v
where not exists (
  select 1 from public.vehicle_driver_ownership_history h where h.vehicle_id = v.id
);

-- ── 2. Re-sync master columns from the open history row ─────────────────────
-- `is distinct from` keeps this idempotent: once master and history agree, a
-- re-run touches nothing. Vehicles with no open row are left alone.

update public.vehicles v
set fuel_ownership = h.ownership
from (
  select distinct on (vehicle_id) vehicle_id, ownership
  from public.vehicle_fuel_ownership_history
  where to_date is null
  order by vehicle_id, from_date desc, created_at desc
) h
where h.vehicle_id = v.id
  and v.fuel_ownership is distinct from h.ownership;

update public.vehicles v
set driver_ownership = h.ownership
from (
  select distinct on (vehicle_id) vehicle_id, ownership
  from public.vehicle_driver_ownership_history
  where to_date is null
  order by vehicle_id, from_date desc, created_at desc
) h
where h.vehicle_id = v.id
  and v.driver_ownership is distinct from h.ownership;

update public.vehicles v
set status = h.status
from (
  select distinct on (vehicle_id) vehicle_id, status
  from public.vehicle_status_history
  where to_date is null
  order by vehicle_id, from_date desc, created_at desc
) h
where h.vehicle_id = v.id
  and v.status is distinct from h.status;

-- Verification — after this migration both queries should return 0.
--
--   -- every vehicle has exactly one open row per history table
--   select count(*) from public.vehicles v
--   where (select count(*) from public.vehicle_fuel_ownership_history
--          where vehicle_id = v.id and to_date is null) <> 1
--      or (select count(*) from public.vehicle_driver_ownership_history
--          where vehicle_id = v.id and to_date is null) <> 1;
--
--   -- master columns agree with their open history row
--   select count(*) from public.vehicles v
--   left join lateral (select ownership from public.vehicle_fuel_ownership_history
--     where vehicle_id = v.id and to_date is null
--     order by from_date desc, created_at desc limit 1) fh on true
--   left join lateral (select ownership from public.vehicle_driver_ownership_history
--     where vehicle_id = v.id and to_date is null
--     order by from_date desc, created_at desc limit 1) dh on true
--   left join lateral (select status from public.vehicle_status_history
--     where vehicle_id = v.id and to_date is null
--     order by from_date desc, created_at desc limit 1) sh on true
--   where v.fuel_ownership   is distinct from coalesce(fh.ownership, v.fuel_ownership)
--      or v.driver_ownership is distinct from coalesce(dh.ownership, v.driver_ownership)
--      or v.status           is distinct from coalesce(sh.status,    v.status);
