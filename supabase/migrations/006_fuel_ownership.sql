-- Add fuel_ownership column to vehicles
alter table public.vehicles
  add column if not exists fuel_ownership text not null default 'company'
    check (fuel_ownership in ('company', 'vendor'));

-- Append-only history table (mirrors vehicle_status_history)
create table if not exists public.vehicle_fuel_ownership_history (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  ownership   text not null check (ownership in ('company', 'vendor')),
  remarks     text,
  from_date   date not null,
  to_date     date,
  changed_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_fuel_ownership_vehicle
  on public.vehicle_fuel_ownership_history(vehicle_id);
create index if not exists idx_fuel_ownership_open
  on public.vehicle_fuel_ownership_history(vehicle_id, to_date);

-- Prevent deletions (history is permanent)
create or replace trigger prevent_fuel_ownership_history_delete
before delete on public.vehicle_fuel_ownership_history
for each row execute function public.prevent_history_delete();

-- Rebuild vehicle_current_view to include fuel_ownership.
-- DROP + CREATE (not CREATE OR REPLACE) because we insert fuel_ownership in the
-- middle of the column list — replace can only append columns at the end, not reorder.
-- Safe: no other view depends on vehicle_current_view.
drop view if exists public.vehicle_current_view;
create view public.vehicle_current_view
with (security_invoker = true)
as
select
  v.id as vehicle_id,
  v.registration_no,
  v.vehicle_type,
  v.fuel_type,
  v.fuel_ownership,
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

-- RPC: atomically changes fuel_ownership, closes old history row, opens new one
create or replace function public.change_vehicle_fuel_ownership(
  p_vehicle_id  uuid,
  p_ownership   text,
  p_from_date   date,
  p_changed_by  text,
  p_remarks     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  history_id uuid;
begin
  if p_ownership not in ('company', 'vendor') then
    raise exception 'Invalid fuel ownership value: %', p_ownership;
  end if;

  -- Close the currently open record
  update public.vehicle_fuel_ownership_history
  set to_date = p_from_date - 1
  where vehicle_id = p_vehicle_id and to_date is null;

  -- Update master record
  update public.vehicles
  set fuel_ownership = p_ownership
  where id = p_vehicle_id;

  -- Open new history record
  insert into public.vehicle_fuel_ownership_history
    (vehicle_id, ownership, remarks, from_date, changed_by)
  values
    (p_vehicle_id, p_ownership, p_remarks, p_from_date, p_changed_by)
  returning id into history_id;

  -- Audit log
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'change_vehicle_fuel_ownership',
    'vehicle',
    p_vehicle_id,
    jsonb_build_object('ownership', p_ownership, 'history_id', history_id)
  );

  return history_id;
end;
$$;

grant execute on function public.change_vehicle_fuel_ownership(uuid, text, date, text, text) to authenticated;
