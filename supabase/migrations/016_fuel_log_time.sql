-- 016_fuel_log_time.sql
-- Optional approximate fill time for a fuel entry.
--
-- When present, the per-fill GPS segment window uses this exact instant instead of
-- the date's midnight, which improves mileage accuracy and gives a real distance
-- for multiple fills on the same day (date-only fills produced a 0 km segment).
-- Entered in IST on the form and stored as an absolute timestamp; nullable so old
-- rows and "date only" entries keep working (the sync falls back to the date).

ALTER TABLE public.vehicle_fuel_logs
  ADD COLUMN IF NOT EXISTS logged_at TIMESTAMPTZ NULL;
