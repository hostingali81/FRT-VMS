-- 005_performance_indexes.sql
-- Optimizing foreign key lookups, sorting, and dashboard views

-- 1. Foreign Key Indexes (Postgres doesn't index FKs by default)
CREATE INDEX IF NOT EXISTS idx_circles_zone_id ON public.circles(zone_id);
CREATE INDEX IF NOT EXISTS idx_divisions_circle_id ON public.divisions(circle_id);
CREATE INDEX IF NOT EXISTS idx_substations_division_id ON public.substations(division_id);

-- 2. Sorting & Filtering Indexes for Vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON public.vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_fuel ON public.vehicles(fuel_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON public.vehicles(created_at DESC);

-- 3. Optimization for Activity Feed (Union of Transfer & Status History)
CREATE INDEX IF NOT EXISTS idx_transfer_history_created_at ON public.vehicle_transfer_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON public.vehicle_status_history(created_at DESC);

-- 4. Optimization for Vehicle History Timelines
CREATE INDEX IF NOT EXISTS idx_transfer_history_vehicle_date ON public.vehicle_transfer_history(vehicle_id, transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_status_history_vehicle_date ON public.vehicle_status_history(vehicle_id, from_date DESC);

-- 5. Driver Sorting & Lookups
CREATE INDEX IF NOT EXISTS idx_drivers_name ON public.drivers(name);
CREATE INDEX IF NOT EXISTS idx_drivers_license_expiry ON public.drivers(license_expiry);

-- 6. User Profiles lookup by Zone (for Zonal Managers)
CREATE INDEX IF NOT EXISTS idx_user_profiles_zone ON public.user_profiles(zone_id);

-- 7. Specific optimization for the "Current Drivers" lookup in Vehicle Profile
-- (Helper for joins between driver_assignments and drivers)
CREATE INDEX IF NOT EXISTS idx_driver_assignments_current ON public.driver_assignments(vehicle_id, driver_id) WHERE to_date IS NULL;
