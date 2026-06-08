-- 011_cleanup_rls_and_backfill.sql
-- Housekeeping migration:
--   1. Align transfer RLS with the application permission model (lib/permissions.ts)
--      so division_incharge can no longer initiate vehicle transfers.
--   2. Backfill an initial driver-source history row for vehicles created before
--      010_driver_ownership.sql.
--
-- NOTE: All app mutations run through the service-role client and SECURITY DEFINER
-- RPCs, both of which bypass RLS — so RLS here is a secondary/defence-in-depth layer.
-- The authoritative checks live in lib/permissions.ts. This keeps the two in sync.

-- 1. Transfer history insert: circle_incharge (same-circle in practice) and
--    zonal_manager / super_admin (cross-circle). division_incharge removed.
drop policy if exists "transfer_history_insert_scoped" on public.vehicle_transfer_history;
create policy "transfer_history_insert_scoped" on public.vehicle_transfer_history
for insert to authenticated
with check (
  public.is_super_admin()
  or (
    public.current_role() in ('zonal_manager', 'circle_incharge')
    and (public.can_access_circle(to_circle_id) or public.can_access_circle(from_circle_id))
  )
);

-- 2. Backfill: every existing vehicle gets one open driver-source history row.
--    Idempotent — only inserts where no history exists yet.
insert into public.vehicle_driver_ownership_history (vehicle_id, ownership, from_date, changed_by, remarks)
select v.id, v.driver_ownership, current_date, 'System', 'Backfill — initial driver source'
from public.vehicles v
where not exists (
  select 1 from public.vehicle_driver_ownership_history h
  where h.vehicle_id = v.id
);
