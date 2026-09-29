-- 023_user_division_access.sql
--
-- Extra division access grants.
--
-- A division user is scoped to exactly one division (user_profiles.division_id),
-- which is right for the substation FRT vans but wrong for the QRT van: QRT is a
-- division of its own with a single vehicle in it, so nobody below circle level
-- can see it — and therefore nobody below circle level can log its fuel.
--
-- Rather than widen the role model, the super admin names which existing users
-- also get a given division. Granting "QRT" to a division user is how "who fuels
-- the QRT vehicle" is answered: the van shows up in their vehicle list and on
-- /fuel-log/add like any vehicle of their own division.
--
-- The grant is a set, not a second scope column, so one QRT can be shared by
-- several people and a user can hold more than one extra division.

create table if not exists public.user_division_access (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, division_id)
);

create index if not exists idx_user_division_access_user
  on public.user_division_access(user_id);

-- As with every other table since 011, the authoritative permission checks live
-- in lib/permissions.ts and all writes go through the service-role client, which
-- bypasses RLS. This is the defence-in-depth layer: the anon key ships in the
-- client bundle, so the table must not be readable or writable with it.
alter table public.user_division_access enable row level security;

drop policy if exists "user_division_access_select" on public.user_division_access;
create policy "user_division_access_select" on public.user_division_access
for select to authenticated
using (user_id = auth.uid() or public.is_super_admin());

-- ── can_access_division: honour the grants ──────────────────────────────────
-- The RLS helper from 003 only knew about the profile's own division/circle, so
-- the policies built on it would still hide a granted division's rows.
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
        from public.user_division_access a
        where a.user_id = p.id
          and a.division_id = target_division_id
      )
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
  ), false);
$$;
