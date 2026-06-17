// Pure mileage maths — no Supabase, no server-only imports, so it works in both
// Server Components and Client Components.
import type { FuelLogEntry } from "@/lib/types";

export type MileageBreakdown = {
  kmpl: number; // distanceKm / litres, 1 decimal
  distanceKm: number; // GPS distance over the window (sum of segments, first excluded)
  litres: number; // fuel that was actually burned in the window
  fromDate: string; // window's first fill (YYYY-MM-DD)
  toDate: string; // window's latest fill (YYYY-MM-DD)
  fills: number; // number of fills in the window
};

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

/**
 * Mileage (km/L) for a window of fuel logs using the empty-tank ("fill when the
 * tank is empty") tankful method:
 *
 *   distance = sum of the per-fill GPS segment distances WITHIN the window, except
 *              the window's first fill's segment (that distance was driven before
 *              the window started, so it doesn't belong here).
 *   fuel     = total litres in the window MINUS the latest fill — that last tankful
 *              was just put into an empty tank and hasn't been burned yet.
 *   kmpl     = distance / fuel
 *
 * Pass a single month's logs for the monthly figure, or all of a vehicle's logs for
 * the all-time figure — the maths is identical, only the window changes.
 *
 * Returns null when there aren't enough fills, the fuel works out to zero, or a
 * required GPS segment hasn't been synced yet — so we never show a misleadingly low
 * number built on missing distance.
 */
export function computeMileage(logs: FuelLogEntry[]): MileageBreakdown | null {
  if (logs.length < 2) return null;

  // Ascending by date, then created_at, so "first" and "latest" stay deterministic
  // even when two fills share the same calendar date.
  const asc = [...logs].sort((a, b) => {
    if (a.log_date !== b.log_date) return a.log_date.localeCompare(b.log_date);
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });

  // Fuel: every fill except the latest one (its tankful isn't burned yet).
  const litres = round(
    asc.slice(0, -1).reduce((sum, l) => sum + (l.fuel_litres ?? 0), 0),
    2,
  );
  if (litres <= 0) return null;

  // Distance: every fill's segment except the window's first fill (index 0), whose
  // segment reaches back before the window.
  let distanceKm = 0;
  for (let i = 1; i < asc.length; i++) {
    const seg = asc[i].gps_distance_km;
    if (seg == null) return null; // not fully synced → don't show a partial number
    distanceKm += seg;
  }
  distanceKm = round(distanceKm, 2);

  return {
    kmpl: round(distanceKm / litres, 1),
    distanceKm,
    litres,
    fromDate: asc[0].log_date,
    toDate: asc[asc.length - 1].log_date,
    fills: asc.length,
  };
}

/** Mileage for a single YYYY-MM month, taken from a vehicle's full log list. */
export function mileageForMonth(allLogs: FuelLogEntry[], yearMonth: string): MileageBreakdown | null {
  return computeMileage(allLogs.filter((l) => l.log_date.startsWith(yearMonth)));
}
