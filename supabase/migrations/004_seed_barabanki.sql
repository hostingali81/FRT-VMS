insert into public.zones (name)
values ('Central UP')
on conflict (name) do nothing;

insert into public.circles (name, zone_id, state, discom, contract_ref)
select 'Barabanki', z.id, 'Uttar Pradesh', 'MVVNL', 'EDC-BBK-FRT-2026'
from public.zones z
where z.name = 'Central UP'
on conflict (name) do update set
  zone_id = excluded.zone_id,
  contract_ref = excluded.contract_ref;

insert into public.divisions (name, circle_id)
select division_name, c.id
from public.circles c
cross join (values
  ('Barabanki'),
  ('Fatehpur'),
  ('Haidergarh'),
  ('Ramnagar'),
  ('Ramsanehighat')
) as source(division_name)
where c.name = 'Barabanki'
on conflict (name, circle_id) do nothing;

insert into public.substations (name, division_id)
select source.substation_name, d.id
from public.divisions d
join public.circles c on c.id = d.circle_id
join (values
  ('Barabanki', 'Naka Satrikh'),
  ('Barabanki', 'Dewa Road'),
  ('Barabanki', 'Civil Lines'),
  ('Fatehpur', 'Fatehpur Town'),
  ('Fatehpur', 'Belhara'),
  ('Haidergarh', 'Haidergarh Town'),
  ('Haidergarh', 'Trivediganj'),
  ('Ramnagar', 'Ramnagar Rural'),
  ('Ramnagar', 'Mahadeva'),
  ('Ramsanehighat', 'Ramsanehighat Town'),
  ('Ramsanehighat', 'Dariyabad')
) as source(division_name, substation_name)
  on source.division_name = d.name
where c.name = 'Barabanki'
on conflict (name, division_id) do nothing;

with circle_row as (
  select id from public.circles where name = 'Barabanki'
)
insert into public.vehicles (
  registration_no,
  vehicle_type,
  fuel_type,
  model_year,
  owner_name,
  owner_mobile,
  vendor_name,
  gps_company,
  gps_device_id,
  circle_id,
  insurance_expiry,
  fitness_expiry,
  pollution_expiry,
  status,
  notes
)
select *
from (
  values
    ('UP32 AB 1245', 'Bolero', 'Diesel', 2021, 'Rajesh Verma', '9876543210', 'Imperial Fleet Services', 'Airtel GPS', 'GPS-BBK-001', (select id from circle_row), current_date + 80, current_date + 160, current_date + 25, 'active', 'Primary FRT van for city feeder faults'),
    ('UP32 CD 8831', 'Pickup', 'Diesel', 2020, 'S K Motors', '9876543211', 'Imperial Fleet Services', 'Trackpoint', 'GPS-BBK-002', (select id from circle_row), current_date + 18, current_date + 75, current_date + 9, 'maintenance', 'Tyre replacement pending'),
    ('UP41 AF 5521', 'Bolero', 'Diesel', 2022, 'Amit Transport', '9876543212', 'Amit Transport', 'Airtel GPS', 'GPS-BBK-003', (select id from circle_row), current_date + 210, current_date + 120, current_date + 42, 'active', null),
    ('UP41 GH 7712', 'Scorpio', 'Diesel', 2019, 'Khan Associates', '9876543213', 'Khan Associates', 'Trackpoint', 'GPS-BBK-004', (select id from circle_row), current_date - 6, current_date + 22, current_date + 60, 'breakdown', 'Engine inspection at workshop'),
    ('UP32 JK 9088', 'Bolero', 'Diesel', 2023, 'Imperial Electric', '9876543214', 'Imperial Fleet Services', 'Airtel GPS', 'GPS-BBK-005', (select id from circle_row), current_date + 365, current_date + 280, current_date + 130, 'standby', 'Reserve van')
) as rows(
  registration_no,
  vehicle_type,
  fuel_type,
  model_year,
  owner_name,
  owner_mobile,
  vendor_name,
  gps_company,
  gps_device_id,
  circle_id,
  insurance_expiry,
  fitness_expiry,
  pollution_expiry,
  status,
  notes
)
on conflict (registration_no) do update set
  status = excluded.status,
  insurance_expiry = excluded.insurance_expiry,
  fitness_expiry = excluded.fitness_expiry,
  pollution_expiry = excluded.pollution_expiry;

with locations as (
  select
    v.id as vehicle_id,
    c.id as circle_id,
    d.id as division_id,
    s.id as substation_id,
    v.registration_no
  from public.vehicles v
  join public.circles c on c.id = v.circle_id
  join public.divisions d on d.circle_id = c.id
  join public.substations s on s.division_id = d.id
  where c.name = 'Barabanki'
)
insert into public.vehicle_assignments (
  vehicle_id,
  circle_id,
  division_id,
  substation_id,
  assigned_from,
  assigned_by,
  notes
)
select vehicle_id, circle_id, division_id, substation_id, current_date - offset_days, 'System Seed', 'Initial deployment'
from (
  select vehicle_id, circle_id, division_id, substation_id, 40 as offset_days
  from locations where registration_no = 'UP32 AB 1245' and substation_id in (
    select s.id from public.substations s join public.divisions d on d.id = s.division_id where d.name = 'Barabanki' and s.name = 'Naka Satrikh'
  )
  union all
  select vehicle_id, circle_id, division_id, substation_id, 32
  from locations where registration_no = 'UP32 CD 8831' and substation_id in (
    select s.id from public.substations s join public.divisions d on d.id = s.division_id where d.name = 'Fatehpur' and s.name = 'Fatehpur Town'
  )
  union all
  select vehicle_id, circle_id, division_id, substation_id, 27
  from locations where registration_no = 'UP41 AF 5521' and substation_id in (
    select s.id from public.substations s join public.divisions d on d.id = s.division_id where d.name = 'Haidergarh' and s.name = 'Trivediganj'
  )
  union all
  select vehicle_id, circle_id, division_id, substation_id, 11
  from locations where registration_no = 'UP41 GH 7712' and substation_id in (
    select s.id from public.substations s join public.divisions d on d.id = s.division_id where d.name = 'Ramnagar' and s.name = 'Ramnagar Rural'
  )
  union all
  select vehicle_id, circle_id, division_id, substation_id, 5
  from locations where registration_no = 'UP32 JK 9088' and substation_id in (
    select s.id from public.substations s join public.divisions d on d.id = s.division_id where d.name = 'Ramsanehighat' and s.name = 'Ramsanehighat Town'
  )
) as rows
on conflict (vehicle_id) do update set
  circle_id = excluded.circle_id,
  division_id = excluded.division_id,
  substation_id = excluded.substation_id,
  assigned_from = excluded.assigned_from,
  assigned_by = excluded.assigned_by,
  notes = excluded.notes;

with circle_row as (
  select id from public.circles where name = 'Barabanki'
)
insert into public.drivers (name, mobile, license_no, license_expiry, address, circle_id, status)
select *
from (
  values
    ('Ramesh Yadav', '9450001001', 'UP142026001', current_date + 320, 'Barabanki', (select id from circle_row), 'active'),
    ('Sajid Ali', '9450001002', 'UP142026002', current_date + 24, 'Fatehpur', (select id from circle_row), 'active'),
    ('Mohan Singh', '9450001003', 'UP142026003', current_date + 190, 'Haidergarh', (select id from circle_row), 'active'),
    ('Dinesh Pal', '9450001004', 'UP142026004', current_date - 3, 'Ramnagar', (select id from circle_row), 'active'),
    ('Virendra Kumar', '9450001005', 'UP142026005', current_date + 88, 'Ramsanehighat', (select id from circle_row), 'inactive')
) as rows(name, mobile, license_no, license_expiry, address, circle_id, status)
on conflict do nothing;

insert into public.driver_assignments (vehicle_id, driver_id, shift, from_date, remarks)
select v.id, d.id, rows.shift, current_date - rows.offset_days, 'Seed assignment'
from (values
  ('UP32 AB 1245', 'Ramesh Yadav', 'morning', 40),
  ('UP32 AB 1245', 'Sajid Ali', 'evening', 20),
  ('UP41 AF 5521', 'Mohan Singh', 'morning', 27),
  ('UP41 GH 7712', 'Dinesh Pal', 'night', 11)
) as rows(registration_no, driver_name, shift, offset_days)
join public.vehicles v on v.registration_no = rows.registration_no
join public.drivers d on d.name = rows.driver_name
on conflict do nothing;

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
select
  v.id,
  c.id,
  fd.id,
  fs.id,
  c.id,
  td.id,
  ts.id,
  current_date - 27,
  'Interchange',
  'Circle Incharge',
  'Moved after feeder load review'
from public.vehicles v
join public.circles c on c.name = 'Barabanki'
join public.divisions fd on fd.circle_id = c.id and fd.name = 'Haidergarh'
join public.substations fs on fs.division_id = fd.id and fs.name = 'Haidergarh Town'
join public.divisions td on td.circle_id = c.id and td.name = 'Haidergarh'
join public.substations ts on ts.division_id = td.id and ts.name = 'Trivediganj'
where v.registration_no = 'UP41 AF 5521'
  and not exists (
    select 1 from public.vehicle_transfer_history th
    where th.vehicle_id = v.id and th.transfer_date = current_date - 27
  );

insert into public.vehicle_status_history (vehicle_id, status, remarks, from_date, recorded_by)
select v.id, v.status, coalesce(v.notes, 'Initial status'), current_date - 7, 'System Seed'
from public.vehicles v
where not exists (
  select 1 from public.vehicle_status_history sh where sh.vehicle_id = v.id
);
