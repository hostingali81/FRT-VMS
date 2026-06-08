-- FRT 41 (DULHADEPUR) registration correction.
-- The plate was mistyped as UP78ST3092 during import; the correct plate
-- (matching the GPS device) is UP78FT3092.
update public.vehicles
set registration_no = 'UP78FT3092'
where registration_no = 'UP78ST3092';
