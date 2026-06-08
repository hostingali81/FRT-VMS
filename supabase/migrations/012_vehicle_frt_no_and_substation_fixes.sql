-- Add FRT number to vehicles (per-vehicle FRT identifier, e.g. "FRT 1")
alter table public.vehicles
  add column if not exists frt_no text;

-- Reconcile substation names with the authoritative vehicle sheet (Excel master).
-- These were created with provisional names; align them so vehicle imports resolve.
update public.substations set name = 'PALHARI OLD' where name = 'PALHARI';
update public.substations set name = 'BHILWAL'     where name = 'BHILWAL(DDUGJY)';
update public.substations set name = 'SIDHAUR'     where name = 'SIDHAUR (DDUGJY)';

-- Rebuild vehicle_current_view to expose frt_no (DROP + CREATE because the column
-- is inserted mid-list, right after registration_no; CREATE OR REPLACE can't reorder).
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
