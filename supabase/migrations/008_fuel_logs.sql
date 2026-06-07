-- 008_fuel_logs.sql
-- Vehicle fuel consumption tracking (per fill-up)
-- fuel_litres and fuel_amount are entered manually, only for company-owned vehicles.
-- gps_distance_km is the distance driven SINCE THE PREVIOUS fill-up, auto-populated
-- from the Millitrack/Traccar GPS API via the "Sync GPS Distance" action.
-- Average (km/L) for an entry = gps_distance_km / fuel_litres.

CREATE TABLE IF NOT EXISTS public.vehicle_fuel_logs (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID          NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  log_date        DATE          NOT NULL,
  fuel_litres     NUMERIC(8,2)  NOT NULL,   -- litres filled (company vehicles only)
  fuel_amount     NUMERIC(10,2) NULL,       -- ₹ cost
  gps_distance_km NUMERIC(10,2) NULL,       -- km since previous fill; filled from GPS sync
  gps_synced_at   TIMESTAMPTZ   NULL,       -- when gps_distance_km was last refreshed
  recorded_by     TEXT          NULL,
  notes           TEXT          NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicle_fuel_logs_vehicle_date
  ON public.vehicle_fuel_logs(vehicle_id, log_date DESC);

CREATE INDEX idx_vehicle_fuel_logs_date
  ON public.vehicle_fuel_logs(log_date DESC);

ALTER TABLE public.vehicle_fuel_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated role that can access the vehicle
CREATE POLICY "fuel_logs_select" ON public.vehicle_fuel_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      LEFT JOIN public.vehicle_assignments va ON va.vehicle_id = v.id
      WHERE v.id = vehicle_fuel_logs.vehicle_id
        AND (
          public.is_super_admin()
          OR public.can_access_circle(v.circle_id)
          OR public.can_access_circle(va.circle_id)
          OR public.can_access_division(va.division_id)
        )
    )
  );

-- INSERT: division_incharge and above, only for vehicles they can access
CREATE POLICY "fuel_logs_insert" ON public.vehicle_fuel_logs
  FOR INSERT WITH CHECK (
    public.current_role() IN ('super_admin', 'zonal_manager', 'circle_incharge', 'division_incharge')
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      LEFT JOIN public.vehicle_assignments va ON va.vehicle_id = v.id
      WHERE v.id = vehicle_fuel_logs.vehicle_id
        AND (
          public.is_super_admin()
          OR public.can_access_circle(v.circle_id)
          OR public.can_access_circle(va.circle_id)
          OR public.can_access_division(va.division_id)
        )
    )
  );

-- UPDATE: needed so the GPS sync can write gps_distance_km. super_admin only.
CREATE POLICY "fuel_logs_update" ON public.vehicle_fuel_logs
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- DELETE: super_admin and circle_incharge only
CREATE POLICY "fuel_logs_delete" ON public.vehicle_fuel_logs
  FOR DELETE USING (
    public.is_super_admin() OR public.current_role() = 'circle_incharge'
  );
