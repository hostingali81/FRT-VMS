create extension if not exists pgcrypto;

create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  zone_id uuid references public.zones(id) on delete set null,
  state text not null default 'Uttar Pradesh',
  discom text not null default 'MVVNL',
  contract_ref text,
  created_at timestamptz not null default now()
);

create table if not exists public.divisions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  circle_id uuid not null references public.circles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (name, circle_id)
);

create table if not exists public.substations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  division_id uuid not null references public.divisions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (name, division_id)
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_no text not null unique,
  vehicle_type text,
  fuel_type text,
  model_year integer,
  owner_name text,
  owner_mobile text,
  vendor_name text,
  gps_company text,
  gps_device_id text,
  circle_id uuid not null references public.circles(id),
  insurance_expiry date,
  fitness_expiry date,
  pollution_expiry date,
  rc_copy_url text,
  status text not null default 'active'
    check (status in ('active', 'maintenance', 'breakdown', 'removed', 'standby', 'accident')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vehicles_circle on public.vehicles(circle_id);
create index if not exists idx_vehicles_status on public.vehicles(status);
create index if not exists idx_vehicles_vendor on public.vehicles(vendor_name);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text,
  license_no text,
  license_expiry date,
  address text,
  circle_id uuid not null references public.circles(id),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_drivers_circle on public.drivers(circle_id);
create index if not exists idx_drivers_status on public.drivers(status);

create table if not exists public.vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  circle_id uuid not null references public.circles(id),
  division_id uuid not null references public.divisions(id),
  substation_id uuid not null references public.substations(id),
  assigned_from date not null,
  assigned_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_id)
);

create index if not exists idx_vehicle_assignments_circle on public.vehicle_assignments(circle_id);
create index if not exists idx_vehicle_assignments_division on public.vehicle_assignments(division_id);
create index if not exists idx_vehicle_assignments_substation on public.vehicle_assignments(substation_id);

create table if not exists public.vehicle_transfer_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  from_circle_id uuid references public.circles(id),
  from_division_id uuid references public.divisions(id),
  from_substation_id uuid references public.substations(id),
  to_circle_id uuid references public.circles(id),
  to_division_id uuid references public.divisions(id),
  to_substation_id uuid references public.substations(id),
  transfer_date date not null,
  reason text,
  approved_by text,
  remarks text,
  is_cross_circle boolean generated always as (
    coalesce(from_circle_id, '00000000-0000-0000-0000-000000000000'::uuid)
    <> coalesce(to_circle_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists idx_transfer_vehicle on public.vehicle_transfer_history(vehicle_id);
create index if not exists idx_transfer_date on public.vehicle_transfer_history(transfer_date);
create index if not exists idx_transfer_to_circle on public.vehicle_transfer_history(to_circle_id);

create table if not exists public.vehicle_status_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  status text not null check (status in ('active', 'maintenance', 'breakdown', 'removed', 'standby', 'accident')),
  remarks text,
  from_date date not null,
  to_date date,
  recorded_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_status_history_vehicle on public.vehicle_status_history(vehicle_id);
create index if not exists idx_status_history_open on public.vehicle_status_history(vehicle_id, to_date);

create table if not exists public.driver_assignments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid not null references public.drivers(id),
  shift text not null check (shift in ('morning', 'evening', 'night')),
  from_date date not null,
  to_date date,
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_assign_vehicle on public.driver_assignments(vehicle_id);
create index if not exists idx_driver_assign_driver on public.driver_assignments(driver_id);
create unique index if not exists idx_driver_assign_current_shift
  on public.driver_assignments(vehicle_id, shift)
  where to_date is null;

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  document_type text not null check (document_type in ('rc', 'insurance', 'fitness', 'pollution', 'permit', 'other')),
  file_path text,
  expiry_date date,
  notes text,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_vehicle_documents_vehicle on public.vehicle_documents(vehicle_id);
create index if not exists idx_vehicle_documents_expiry on public.vehicle_documents(expiry_date);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null
    check (role in ('super_admin', 'zonal_manager', 'circle_incharge', 'division_incharge', 'viewer')),
  circle_id uuid references public.circles(id),
  division_id uuid references public.divisions(id),
  zone_id uuid references public.zones(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_role on public.user_profiles(role);
create index if not exists idx_user_profiles_circle on public.user_profiles(circle_id);
create index if not exists idx_user_profiles_division on public.user_profiles(division_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at);

create table if not exists public.system_settings (
  id boolean primary key default true,
  company_name text not null default 'The Imperial Electric Company',
  expiry_alert_days integer not null default 30,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_settings_singleton check (id)
);

insert into public.system_settings (id)
values (true)
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

create or replace trigger drivers_set_updated_at
before update on public.drivers
for each row execute function public.set_updated_at();

create or replace trigger vehicle_assignments_set_updated_at
before update on public.vehicle_assignments
for each row execute function public.set_updated_at();

create or replace trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace trigger system_settings_set_updated_at
before update on public.system_settings
for each row execute function public.set_updated_at();

create or replace function public.prevent_history_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'History rows are append-only and cannot be deleted';
end;
$$;

create or replace trigger prevent_transfer_history_delete
before delete on public.vehicle_transfer_history
for each row execute function public.prevent_history_delete();

create or replace trigger prevent_status_history_delete
before delete on public.vehicle_status_history
for each row execute function public.prevent_history_delete();

create or replace trigger prevent_driver_assignment_delete
before delete on public.driver_assignments
for each row execute function public.prevent_history_delete();

insert into storage.buckets (id, name, public)
values ('vehicle-documents', 'vehicle-documents', false)
on conflict (id) do nothing;
