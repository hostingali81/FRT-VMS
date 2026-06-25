-- FRT number now denotes a SUBSTATION / posting, not an individual vehicle.
--
-- Previously frt_no lived on `vehicles` and travelled with the vehicle on transfer.
-- So swapping two vehicles between substations made each substation appear to
-- "change" its FRT number (the label followed the vehicle). FRT identifies the
-- posting, so move it to the substation and derive the vehicle's displayed FRT
-- from its CURRENT substation. Now FRT stays put when vehicles move.

-- ── 1. substations: own FRT number ───────────────────────────────────────────
alter table public.substations
  add column if not exists frt_no text;

-- ── 2. Backfill each substation's FRT from the vehicle currently posted there ─
-- Most substations host a single FRT vehicle (1:1). If more than one is currently
-- assigned, pick the lowest frt_no deterministically. vehicles.frt_no is kept as
-- the historical source but is no longer read by the application.
update public.substations s
set frt_no = pick.frt_no
from (
  select distinct on (va.substation_id)
    va.substation_id,
    v.frt_no
  from public.vehicle_assignments va
  join public.vehicles v on v.id = va.vehicle_id
  where v.frt_no is not null
    and v.status <> 'removed'
  order by va.substation_id, v.frt_no
) pick
where s.id = pick.substation_id
  and s.frt_no is null;

-- ── 3. vehicle_current_view: source frt_no from the CURRENT substation ───────
-- Only the expression behind the existing `frt_no` column changes (v.frt_no →
-- s.frt_no); the column name, type and position are unchanged, so CREATE OR
-- REPLACE is allowed (no DROP needed — keeps any dependents intact).
create or replace view public.vehicle_current_view
with (security_invoker = true)
as
select
  v.id as vehicle_id,
  v.registration_no,
  s.frt_no,
  v.vehicle_type,
  v.fuel_type,
  v.fuel_ownership,
  v.driver_ownership,
  v.model_year,
  v.owner_name,
  v.owner_mobile,
  v.vendor_name,
  v.vendor_mobile,
  v.gps_company,
  v.gps_device_id,
  v.circle_id as home_circle_id,
  hc.name as home_circle,
  v.insurance_expiry,
  v.fitness_expiry,
  v.pollution_expiry,
  v.rc_copy_url,
  v.status,
  v.notes,
  v.created_at,
  v.updated_at,
  va.id as assignment_id,
  va.circle_id as current_circle_id,
  cc.name as current_circle,
  va.division_id,
  d.name as division,
  va.substation_id,
  s.name as substation,
  va.assigned_from,
  va.assigned_by
from public.vehicles v
join public.circles hc on hc.id = v.circle_id
left join public.vehicle_assignments va on va.vehicle_id = v.id
left join public.circles cc on cc.id = va.circle_id
left join public.divisions d on d.id = va.division_id
left join public.substations s on s.id = va.substation_id;
