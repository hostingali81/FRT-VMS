create or replace function public.current_profile()
returns public.user_profiles
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.user_profiles
  where id = auth.uid()
    and is_active = true
  limit 1
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.current_profile()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'super_admin' from public.current_profile()), false)
$$;

create or replace function public.can_access_circle(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      p.role = 'super_admin'
      or (p.role = 'zonal_manager' and exists (
        select 1 from public.circles c
        where c.id = target_circle_id and c.zone_id = p.zone_id
      ))
      or p.circle_id = target_circle_id
    from public.current_profile() p
  ), false)
$$;

create or replace function public.can_access_division(target_division_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      p.role = 'super_admin'
      or p.division_id = target_division_id
      or exists (
        select 1
        from public.divisions d
        join public.circles c on c.id = d.circle_id
        where d.id = target_division_id
          and (
            p.circle_id = d.circle_id
            or (p.role = 'zonal_manager' and c.zone_id = p.zone_id)
          )
      )
    from public.current_profile() p
  ), false)
$$;

create or replace function public.can_access_substation(target_substation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.substations s
    where s.id = target_substation_id
      and public.can_access_division(s.division_id)
  )
$$;

alter table public.zones enable row level security;
alter table public.circles enable row level security;
alter table public.divisions enable row level security;
alter table public.substations enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicle_assignments enable row level security;
alter table public.vehicle_transfer_history enable row level security;
alter table public.vehicle_status_history enable row level security;
alter table public.driver_assignments enable row level security;
alter table public.vehicle_documents enable row level security;
alter table public.user_profiles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;

create policy "zones_select_visible" on public.zones
for select to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1 from public.current_profile() p
    where p.zone_id = zones.id or p.role in ('circle_incharge', 'division_incharge', 'viewer')
  )
);

create policy "zones_admin_all" on public.zones
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "circles_select_visible" on public.circles
for select to authenticated
using (public.can_access_circle(id));

create policy "circles_admin_all" on public.circles
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "divisions_select_visible" on public.divisions
for select to authenticated
using (public.can_access_division(id));

create policy "divisions_admin_all" on public.divisions
for all to authenticated
using (public.is_super_admin() or (public.current_role() = 'circle_incharge' and public.can_access_circle(circle_id)))
with check (public.is_super_admin() or (public.current_role() = 'circle_incharge' and public.can_access_circle(circle_id)));

create policy "substations_select_visible" on public.substations
for select to authenticated
using (public.can_access_substation(id));

create policy "substations_admin_all" on public.substations
for all to authenticated
using (public.is_super_admin() or (public.current_role() = 'circle_incharge' and public.can_access_division(division_id)))
with check (public.is_super_admin() or (public.current_role() = 'circle_incharge' and public.can_access_division(division_id)));

create policy "vehicles_select_visible" on public.vehicles
for select to authenticated
using (
  public.can_access_circle(circle_id)
  or exists (
    select 1 from public.vehicle_assignments va
    where va.vehicle_id = vehicles.id
      and (public.can_access_circle(va.circle_id) or public.can_access_division(va.division_id))
  )
);

create policy "vehicles_modify_scoped" on public.vehicles
for all to authenticated
using (
  public.is_super_admin()
  or (
    public.current_role() in ('circle_incharge', 'division_incharge')
    and public.can_access_circle(circle_id)
  )
)
with check (
  public.is_super_admin()
  or (
    public.current_role() in ('circle_incharge', 'division_incharge')
    and public.can_access_circle(circle_id)
  )
);

create policy "drivers_select_visible" on public.drivers
for select to authenticated
using (public.can_access_circle(circle_id));

create policy "drivers_modify_scoped" on public.drivers
for all to authenticated
using (
  public.is_super_admin()
  or (public.current_role() in ('circle_incharge', 'division_incharge') and public.can_access_circle(circle_id))
)
with check (
  public.is_super_admin()
  or (public.current_role() in ('circle_incharge', 'division_incharge') and public.can_access_circle(circle_id))
);

create policy "vehicle_assignments_select_visible" on public.vehicle_assignments
for select to authenticated
using (public.can_access_circle(circle_id) or public.can_access_division(division_id));

create policy "vehicle_assignments_modify_scoped" on public.vehicle_assignments
for all to authenticated
using (
  public.is_super_admin()
  or (public.current_role() in ('zonal_manager', 'circle_incharge', 'division_incharge') and public.can_access_circle(circle_id))
)
with check (
  public.is_super_admin()
  or (public.current_role() in ('zonal_manager', 'circle_incharge', 'division_incharge') and public.can_access_circle(circle_id))
);

create policy "transfer_history_select_visible" on public.vehicle_transfer_history
for select to authenticated
using (
  public.can_access_circle(from_circle_id)
  or public.can_access_circle(to_circle_id)
  or public.can_access_division(from_division_id)
  or public.can_access_division(to_division_id)
);

create policy "transfer_history_insert_scoped" on public.vehicle_transfer_history
for insert to authenticated
with check (
  public.is_super_admin()
  or (
    public.current_role() in ('zonal_manager', 'circle_incharge', 'division_incharge')
    and (public.can_access_circle(to_circle_id) or public.can_access_circle(from_circle_id))
  )
);

create policy "status_history_select_visible" on public.vehicle_status_history
for select to authenticated
using (
  exists (
    select 1 from public.vehicle_assignments va
    where va.vehicle_id = vehicle_status_history.vehicle_id
      and (public.can_access_circle(va.circle_id) or public.can_access_division(va.division_id))
  )
);

create policy "status_history_insert_scoped" on public.vehicle_status_history
for insert to authenticated
with check (
  public.is_super_admin()
  or public.current_role() in ('circle_incharge', 'division_incharge')
);

create policy "driver_assignments_select_visible" on public.driver_assignments
for select to authenticated
using (
  exists (
    select 1 from public.vehicle_assignments va
    where va.vehicle_id = driver_assignments.vehicle_id
      and (public.can_access_circle(va.circle_id) or public.can_access_division(va.division_id))
  )
);

create policy "driver_assignments_modify_scoped" on public.driver_assignments
for all to authenticated
using (
  public.is_super_admin()
  or public.current_role() in ('circle_incharge', 'division_incharge')
)
with check (
  public.is_super_admin()
  or public.current_role() in ('circle_incharge', 'division_incharge')
);

create policy "vehicle_documents_select_visible" on public.vehicle_documents
for select to authenticated
using (
  exists (
    select 1 from public.vehicles v
    where v.id = vehicle_documents.vehicle_id
      and public.can_access_circle(v.circle_id)
  )
);

create policy "vehicle_documents_modify_scoped" on public.vehicle_documents
for all to authenticated
using (
  public.is_super_admin()
  or public.current_role() in ('circle_incharge', 'division_incharge')
)
with check (
  public.is_super_admin()
  or public.current_role() in ('circle_incharge', 'division_incharge')
);

create policy "profiles_select_self_or_admin" on public.user_profiles
for select to authenticated
using (id = auth.uid() or public.is_super_admin());

create policy "profiles_admin_all" on public.user_profiles
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "audit_logs_admin_select" on public.audit_logs
for select to authenticated
using (public.is_super_admin());

create policy "audit_logs_insert_authenticated" on public.audit_logs
for insert to authenticated
with check (actor_id = auth.uid() or actor_id is null);

create policy "settings_select_authenticated" on public.system_settings
for select to authenticated
using (true);

create policy "settings_admin_all" on public.system_settings
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "vehicle_documents_storage_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'vehicle-documents'
  and exists (
    select 1
    from public.vehicle_documents vd
    where vd.file_path = storage.objects.name
  )
);

create policy "vehicle_documents_storage_modify" on storage.objects
for all to authenticated
using (
  bucket_id = 'vehicle-documents'
  and (public.is_super_admin() or public.current_role() in ('circle_incharge', 'division_incharge'))
)
with check (
  bucket_id = 'vehicle-documents'
  and (public.is_super_admin() or public.current_role() in ('circle_incharge', 'division_incharge'))
);
