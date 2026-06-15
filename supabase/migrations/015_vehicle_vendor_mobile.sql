-- Add vendor mobile to vehicles. The application code (forms, validation, types,
-- exports) was updated to track vendor_mobile, but the column never existed in the
-- database — so every vehicle create/update that sends vendor_mobile failed with
-- "column vendor_mobile does not exist", surfacing as the generic error boundary.
alter table public.vehicles
  add column if not exists vendor_mobile text;

-- Rebuild vehicle_current_view to expose vendor_mobile (DROP + CREATE because the
-- column is inserted mid-list, right after vendor_name; CREATE OR REPLACE can't
-- reorder columns). Mirrors the latest definition from migration 012.
drop view if exists public.vehicle_current_view;
create view public.vehicle_current_view
with (security_invoker = true)
as
select
  v.id as vehicle_id,
  v.registration_no,
  v.frt_no,
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
