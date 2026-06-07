-- 009_fuel_log_fuel_type.sql
-- Capture which fuel was filled, per entry (asked at fuel-entry time).
-- Nullable so existing rows stay valid; new entries always provide it.

ALTER TABLE public.vehicle_fuel_logs
  ADD COLUMN IF NOT EXISTS fuel_type text
    CHECK (fuel_type IS NULL OR fuel_type IN ('CNG', 'Petrol', 'Diesel'));
