// Pure mileage maths — no Supabase, no server-only imports, so it works in both
// Server Components and Client Components.
import { FUEL_LOG_TYPES, type FuelLogEntry, type FuelLogType } from "@/lib/types";

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

/** One fuel type's mileage within a window. */
export type FuelMileage = {
  fuelType: FuelLogType | null; // null = legacy logs with no recorded type
  breakdown: MileageBreakdown;
};

/**
 * Per-fuel-type mileage. A bi-fuel vehicle (e.g. CNG to run + a small petrol dose to
 * start) can't be measured on a combined tankful — CNG litres and petrol litres
 * aren't additive, and a same-day cross-type fill breaks the "fill when empty"
 * assumption. So we split the logs by fuel_type and run the tankful method on each
 * type on its own. Types with too few fills (or unsynced segments) are dropped.
 *
 * This is only correct when each fill's gps_distance_km is the GPS distance since the
 * previous fill OF THE SAME TYPE (see syncFuelSegmentDistances) — otherwise the
 * distance driven through an intervening other-type fill would be lost.
 */
export function computeMileageByFuel(logs: FuelLogEntry[]): FuelMileage[] {
  const byType = new Map<FuelLogType | null, FuelLogEntry[]>();
  for (const log of logs) {
    const key = log.fuel_type ?? null;
    const group = byType.get(key);
    if (group) group.push(log);
    else byType.set(key, [log]);
  }

  const out: FuelMileage[] = [];
  for (const [fuelType, group] of Array.from(byType)) {
    const breakdown = computeMileage(group);
    if (breakdown) out.push({ fuelType, breakdown });
  }

  // Stable display order: known fuel types in FUEL_LOG_TYPES order, untyped last.
  const order = (t: FuelLogType | null) =>
    t == null ? FUEL_LOG_TYPES.length : FUEL_LOG_TYPES.indexOf(t);
  return out.sort((a, b) => order(a.fuelType) - order(b.fuelType));
}

/** Per-fuel-type mileage for a single YYYY-MM month, from a vehicle's full log list. */
export function mileageByFuelForMonth(allLogs: FuelLogEntry[], yearMonth: string): FuelMileage[] {
  return computeMileageByFuel(allLogs.filter((l) => l.log_date.startsWith(yearMonth)));
}
