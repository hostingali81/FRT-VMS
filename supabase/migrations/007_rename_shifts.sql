-- Rename driver shifts from morning/evening/night to shift_a/shift_b/shift_c

-- Step 1: Drop existing check constraint on driver_assignments
alter table public.driver_assignments
  drop constraint if exists driver_assignments_shift_check;

-- Step 2: Update existing data
update public.driver_assignments set shift = 'shift_a' where shift = 'morning';
update public.driver_assignments set shift = 'shift_b' where shift = 'evening';
update public.driver_assignments set shift = 'shift_c' where shift = 'night';

-- Step 3: Add new check constraint
alter table public.driver_assignments
  add constraint driver_assignments_shift_check
  check (shift in ('shift_a', 'shift_b', 'shift_c'));

-- Step 4: Update the replace_driver_assignment function to accept new shift values
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
