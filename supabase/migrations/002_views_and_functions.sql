create or replace view public.vehicle_current_view
with (security_invoker = true)
as
select
  v.id as vehicle_id,
  v.registration_no,
  v.vehicle_type,
  v.fuel_type,
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

create or replace view public.circle_fleet_summary
with (security_invoker = true)
as
select
  c.id as circle_id,
  c.name as circle,
  count(v.id)::integer as total,
  count(v.id) filter (where v.status = 'active')::integer as active,
  count(v.id) filter (where v.status = 'maintenance')::integer as maintenance,
  count(v.id) filter (where v.status = 'breakdown')::integer as breakdown,
  count(v.id) filter (where v.status = 'standby')::integer as standby,
  count(v.id) filter (
    where least(
      coalesce(v.insurance_expiry, '9999-12-31'::date),
      coalesce(v.fitness_expiry, '9999-12-31'::date),
      coalesce(v.pollution_expiry, '9999-12-31'::date)
    ) <= current_date + 30
  )::integer as documents_expiring
from public.circles c
left join public.vehicles v on v.circle_id = c.id and v.status <> 'removed'
group by c.id, c.name;

create or replace view public.division_fleet_summary
with (security_invoker = true)
as
select
  c.id as circle_id,
  c.name as circle,
  d.id as division_id,
  d.name as division,
  count(v.id)::integer as total,
  count(v.id) filter (where v.status = 'active')::integer as active,
  count(v.id) filter (where v.status = 'maintenance')::integer as maintenance,
  count(v.id) filter (where v.status = 'breakdown')::integer as breakdown,
  count(v.id) filter (where v.status = 'standby')::integer as standby
from public.divisions d
join public.circles c on c.id = d.circle_id
left join public.vehicle_assignments va on va.division_id = d.id
left join public.vehicles v on v.id = va.vehicle_id and v.status <> 'removed'
group by c.id, c.name, d.id, d.name;

create or replace view public.transfer_history_view
with (security_invoker = true)
as
select
  th.id,
  th.vehicle_id,
  v.registration_no,
  th.transfer_date,
  th.reason,
  th.approved_by,
  th.remarks,
  th.is_cross_circle,
  th.from_circle_id,
  fc.name as from_circle,
  th.from_division_id,
  fd.name as from_division,
  th.from_substation_id,
  fs.name as from_substation,
  th.to_circle_id,
  tc.name as to_circle,
  th.to_division_id,
  td.name as to_division,
  th.to_substation_id,
  ts.name as to_substation,
  th.created_at
from public.vehicle_transfer_history th
join public.vehicles v on v.id = th.vehicle_id
left join public.circles fc on fc.id = th.from_circle_id
left join public.divisions fd on fd.id = th.from_division_id
left join public.substations fs on fs.id = th.from_substation_id
left join public.circles tc on tc.id = th.to_circle_id
left join public.divisions td on td.id = th.to_division_id
left join public.substations ts on ts.id = th.to_substation_id;

create or replace view public.driver_current_view
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
  da.vehicle_id,
  v.registration_no,
  da.shift,
  da.from_date as assigned_from
from public.drivers dr
join public.circles c on c.id = dr.circle_id
left join public.driver_assignments da on da.driver_id = dr.id and da.to_date is null
left join public.vehicles v on v.id = da.vehicle_id;

create or replace view public.activity_feed_view
with (security_invoker = true)
as
select
  th.id,
  'transfer'::text as activity_type,
  th.created_at,
  th.vehicle_id,
  v.registration_no,
  th.to_circle_id as circle_id,
  th.to_division_id as division_id,
  concat(
    coalesce(fc.name, 'Unassigned'),
    ' / ',
    coalesce(fs.name, 'No substation'),
    ' to ',
    coalesce(tc.name, 'Unassigned'),
    ' / ',
    coalesce(ts.name, 'No substation')
  ) as description
from public.vehicle_transfer_history th
join public.vehicles v on v.id = th.vehicle_id
left join public.circles fc on fc.id = th.from_circle_id
left join public.substations fs on fs.id = th.from_substation_id
left join public.circles tc on tc.id = th.to_circle_id
left join public.substations ts on ts.id = th.to_substation_id
union all
select
  sh.id,
  'status'::text as activity_type,
  sh.created_at,
  sh.vehicle_id,
  v.registration_no,
  va.circle_id,
  va.division_id,
  concat('Status changed to ', sh.status, coalesce(': ' || sh.remarks, '')) as description
from public.vehicle_status_history sh
join public.vehicles v on v.id = sh.vehicle_id
left join public.vehicle_assignments va on va.vehicle_id = v.id;

create or replace function public.transfer_vehicle(
  p_vehicle_id uuid,
  p_to_circle_id uuid,
  p_to_division_id uuid,
  p_to_substation_id uuid,
  p_transfer_date date,
  p_reason text,
  p_approved_by text,
  p_remarks text default null
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

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'transfer_vehicle',
    'vehicle',
    p_vehicle_id,
    jsonb_build_object('history_id', new_history_id, 'to_circle_id', p_to_circle_id)
  );

  return new_history_id;
end;
$$;

create or replace function public.change_vehicle_status(
  p_vehicle_id uuid,
  p_status text,
  p_from_date date,
  p_recorded_by text,
  p_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  history_id uuid;
begin
  if p_status not in ('active', 'maintenance', 'breakdown', 'removed', 'standby', 'accident') then
    raise exception 'Invalid vehicle status: %', p_status;
  end if;

  update public.vehicle_status_history
  set to_date = p_from_date - 1
  where vehicle_id = p_vehicle_id and to_date is null;

  update public.vehicles
  set status = p_status
  where id = p_vehicle_id;

  insert into public.vehicle_status_history (
    vehicle_id,
    status,
    remarks,
    from_date,
    recorded_by
  )
  values (p_vehicle_id, p_status, p_remarks, p_from_date, p_recorded_by)
  returning id into history_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload)
  values (
    auth.uid(),
    'change_vehicle_status',
    'vehicle',
    p_vehicle_id,
    jsonb_build_object('status', p_status, 'history_id', history_id)
  );

  return history_id;
end;
$$;

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

  insert into public.driver_assignments (
    vehicle_id,
    driver_id,
    shift,
    from_date,
    remarks
  )
  values (p_vehicle_id, p_driver_id, p_shift, p_from_date, p_remarks)
  returning id into assignment_id;

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

grant execute on function public.transfer_vehicle(uuid, uuid, uuid, uuid, date, text, text, text) to authenticated;
grant execute on function public.change_vehicle_status(uuid, text, date, text, text) to authenticated;
grant execute on function public.replace_driver_assignment(uuid, uuid, text, date, text) to authenticated;
