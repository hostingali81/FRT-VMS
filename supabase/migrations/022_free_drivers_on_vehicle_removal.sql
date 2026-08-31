-- 022_free_drivers_on_vehicle_removal.sql
--
-- Removing a vehicle left its drivers attached to it.
--
-- transfer_vehicle (017) already frees drivers when a vehicle moves away without
-- them: it closes the open driver_assignments rows so the driver detaches and
-- "becomes available for the next vehicle there" — the model the transfer form
-- describes to the user, and the one /drivers renders (driver_current_view joins
-- the OPEN assignment, so an unclosed row keeps showing the driver as occupied).
--
-- change_vehicle_status never got the same treatment, so marking a vehicle
-- 'removed' — "Permanent Removed" in the history register — silently kept its
-- drivers assigned to a vehicle that is gone. Two such rows exist in production.
--
-- Only 'removed' frees drivers. maintenance / breakdown / standby / accident are
-- the "Temporary Removed" statuses: the vehicle is expected back and keeps its
-- crew.

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

  -- A permanently removed vehicle releases its drivers, exactly as a transfer
  -- without move_driver does. They stay posted to their substation and become
  -- available for whichever vehicle is deployed there next.
  if p_status = 'removed' then
    update public.driver_assignments
    set to_date = p_from_date - 1
    where vehicle_id = p_vehicle_id and to_date is null;
  end if;

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

grant execute on function public.change_vehicle_status(uuid, text, date, text, text) to authenticated;

-- Close the assignments already stranded on removed vehicles. Dated the day
-- before the vehicle's open 'removed' history row, matching what the function
-- above would have written at the time.
update public.driver_assignments da
set to_date = sh.from_date - 1
from public.vehicles v
join lateral (
  select from_date
  from public.vehicle_status_history
  where vehicle_id = v.id and status = 'removed' and to_date is null
  order by from_date desc
  limit 1
) sh on true
where da.vehicle_id = v.id
  and da.to_date is null
  and v.status = 'removed';
