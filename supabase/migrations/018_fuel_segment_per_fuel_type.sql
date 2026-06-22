-- 018_fuel_segment_per_fuel_type.sql
-- Per-fuel-type mileage: each fuel log's gps_distance_km is now the GPS distance
-- since the previous fill OF THE SAME FUEL TYPE (not the previous fill of any type).
--
-- Bi-fuel vehicles (e.g. CNG to run + a small petrol dose to start) used to get a
-- 0-km segment whenever a same-day cross-type fill landed between two main-fuel
-- fills, which zeroed out the computed mileage. Clear the synced segments for any
-- vehicle that logs more than one fuel type so the next GPS sync recomputes them
-- with the new same-type logic.
--
-- Single-fuel vehicles are left untouched: their same-type predecessor is already
-- the immediate predecessor, so their stored distances remain correct (and we avoid
-- a needless full-fleet re-sync against the GPS provider).

UPDATE public.vehicle_fuel_logs
SET gps_distance_km = NULL,
    gps_synced_at = NULL
WHERE vehicle_id IN (
  SELECT vehicle_id
  FROM public.vehicle_fuel_logs
  WHERE fuel_type IS NOT NULL
  GROUP BY vehicle_id
  HAVING COUNT(DISTINCT fuel_type) > 1
);
