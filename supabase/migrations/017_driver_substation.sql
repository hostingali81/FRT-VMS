-- Anchor drivers to a SUBSTATION (posting) instead of letting them implicitly
-- follow whatever vehicle they drive.
--
-- Before this migration a driver was tied to a vehicle via driver_assignments;
-- transfer_vehicle never touched those rows, so the driver silently moved with
-- the vehicle. Now a driver is "posted" to a substation. On transfer the driver
-- stays put by default (assignment closed → driver becomes available at the old
-- substation) and only moves when the transfer explicitly asks for it.

-- ── 1. drivers: posting columns ──────────────────────────────────────────────
-- Nullable so existing rows / circle-only drivers don't break. circle_id stays.
alter table public.drivers
  add column if not exists division_id uuid references public.divisions(id),
  add column if not exists substation_id uuid references public.substations(id);

create index if not exists idx_drivers_division on public.drivers(division_id);
create index if not exists idx_drivers_substation on public.drivers(substation_id);

-- Backfill posting from each driver's CURRENT vehicle deployment.
update public.drivers d
set substation_id = va.substation_id,
    division_id   = va.division_id,
    circle_id     = va.circle_id
from public.driver_assignments da
join public.vehicle_assignments va on va.vehicle_id = da.vehicle_id
where da.driver_id = d.id and da.to_date is null;

-- ── 2. driver_current_view: expose the driver's posting ──────────────────────
-- DROP + CREATE because we add posting columns; nothing else depends on this view.
drop view if exists public.driver_current_view;
create view public.driver_current_view
with (security_invoker = true)
as
select
  dr.id as driver_id,
  dr.name,
  dr.mobile,
  dr.license_no,
  dr.license_expiry,
  dr.address,
  dr.status,
  dr.circle_id,
  c.name as circle,
  dr.division_id,
  pd.name as division,
  dr.substation_id,
  ps.name as substation,
  da.vehicle_id,
  v.registration_no,
  da.shift,
  da.from_date as assigned_from
from public.drivers dr
join public.circles c on c.id = dr.circle_id
left join public.divisions pd on pd.id = dr.division_id
left join public.substations ps on ps.id = dr.substation_id
left join public.driver_assignments da on da.driver_id = dr.id and da.to_date is null
left join public.vehicles v on v.id = da.vehicle_id;

-- ── 3. transfer_vehicle: optional "move driver(s) with vehicle" ──────────────
-- Adding a parameter changes the signature, so drop the old function first.
drop function if exists public.transfer_vehicle(uuid, uuid, uuid, uuid, date, text, text, text);

create or replace function public.transfer_vehicle(
  p_vehicle_id uuid,
  p_to_circle_id uuid,
  p_to_division_id uuid,
  p_to_substation_id uuid,
  p_transfer_date date,
  p_reason text,
  p_approved_by text,
  p_remarks text default null,
  p_move_driver boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_assignment record;
  new_history_id uuid;
begin
  select *
  into current_assignment
  from public.vehicle_assignments
  where vehicle_id = p_vehicle_id;

  insert into public.vehicle_transfer_history (
    vehicle_id,
    from_circle_id,
    from_division_id,
    from_substation_id,
    to_circle_id,
    to_division_id,
    to_substation_id,
    transfer_date,
    reason,
    approved_by,
    remarks
  )
  values (
    p_vehicle_id,
    current_assignment.circle_id,
    current_assignment.division_id,
    current_assignment.substation_id,
    p_to_circle_id,
    p_to_division_id,
    p_to_substation_id,
    p_transfer_date,
    p_reason,
    p_approved_by,
    p_remarks
  )
  returning id into new_history_id;

  insert into public.vehicle_assignments (
    vehicle_id,
    circle_id,
    division_id,
    substation_id,
    assigned_from,
    assigned_by,
    notes
  )
  values (
    p_vehicle_id,
    p_to_circle_id,
    p_to_division_id,
    p_to_substation_id,
    p_transfer_date,
    p_approved_by,
    p_remarks
  )
  on conflict (vehicle_id)
  do update set
    circle_id = excluded.circle_id,
    division_id = excluded.division_id,
    substation_id = excluded.substation_id,
    assigned_from = excluded.assigned_from,
    assigned_by = excluded.assigned_by,
    notes = excluded.notes,
    updated_at = now();

  if p_move_driver then
    -- Driver(s) follow the vehicle: re-post them to the destination, keep the
    -- assignment open so they keep driving this vehicle.
    update public.drivers dr
    set substation_id = p_to_substation_id,
        division_id   = p_to_division_id,
        circle_id     = p_to_circle_id
    from public.driver_assignments da
    where da.driver_id = dr.id
      and da.vehicle_id = p_vehicle_id
      and da.to_date is null;
  else
    -- Driver(s) stay at the old substation: close the assignment so they detach
    -- from the moving vehicle and become available for the next vehicle there.
    update public.driver_assignments
    set to_date = p_transfer_date - 1
    where vehicle_id = p_vehicle_id and to_date is null;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'transfer_vehicle',
    'vehicle',
    p_vehicle_id,
    jsonb_build_object('history_id', new_history_id, 'to_circle_id', p_to_circle_id, 'move_driver', p_move_driver)
  );

  return new_history_id;
end;
$$;

grant execute on function public.transfer_vehicle(uuid, uuid, uuid, uuid, date, text, text, text, boolean) to authenticated;

-- ── 4. replace_driver_assignment: posting follows the vehicle on assign ──────
-- When a driver is assigned to a vehicle, post the driver where that vehicle is.
create or replace function public.replace_driver_assignment(
  p_vehicle_id uuid,
  p_driver_id uuid,
  p_shift text,
  p_from_date date,
  p_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_id uuid;
begin
  if p_shift not in ('shift_a', 'shift_b', 'shift_c') then
    raise exception 'Invalid shift: %', p_shift;
  end if;

  update public.driver_assignments
  set to_date = p_from_date - 1
  where vehicle_id = p_vehicle_id
    and shift = p_shift
    and to_date is null;

  insert into public.driver_assignments (vehicle_id, driver_id, shift, from_date, remarks)
  values (p_vehicle_id, p_driver_id, p_shift, p_from_date, p_remarks)
  returning id into assignment_id;

  -- Post the driver to the vehicle's current substation/division/circle.
  update public.drivers dr
  set substation_id = va.substation_id,
      division_id   = va.division_id,
      circle_id     = va.circle_id
  from public.vehicle_assignments va
  where va.vehicle_id = p_vehicle_id and dr.id = p_driver_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'replace_driver_assignment',
    'vehicle',
    p_vehicle_id,
    jsonb_build_object('driver_id', p_driver_id, 'shift', p_shift, 'assignment_id', assignment_id)
  );

  return assignment_id;
end;
$$;

grant execute on function public.replace_driver_assignment(uuid, uuid, text, date, text) to authenticated;
