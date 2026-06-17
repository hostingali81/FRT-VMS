"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getAllLookups, getVehicles } from "@/lib/data";
import { canCreateVehicle, canEditVehicle } from "@/lib/permissions";
import { isMillitrackConfigured, millitrackSummary } from "@/lib/millitrack";
import { isWheelsEyeConfigured, wheelsEyeDistanceByReg } from "@/lib/wheelseye";
import { syncFuelSegmentDistances, syncMonthlyGpsDistance } from "@/lib/gps-distance";

/**
 * Sync monthly GPS distance for GPS-mapped vehicles (independent of fuel logs).
 * Builds month-wise history in vehicle_gps_distance.
 *
 * Open to roles that can create/edit vehicles (super_admin, circle_incharge,
 * division_incharge). Permission-scoped like the RTO refresh: super_admin syncs
 * the whole fleet, while circle/division incharge sync only the vehicles they can
 * edit, so they never touch another location's data.
 */
export async function syncGpsMonthlyDistanceAction() {
  const profile = await requireProfile();
  if (!canCreateVehicle(profile)) {
    throw new Error("Unauthorized: you don't have permission to sync GPS distance");
  }

  // super_admin: no filter → whole GPS-mapped fleet (same as the daily cron).
  // Other roles: restrict to the vehicles they can edit.
  let allowedIds: Set<string> | null = null;
  if (profile.role !== "super_admin") {
    const lookups = await getAllLookups();
    const vehicles = await getVehicles(profile);
    const editable = vehicles.filter(
      (vehicle) => vehicle.status !== "removed" && canEditVehicle(profile, vehicle, lookups),
    );
    if (editable.length === 0) {
      redirect("/fuel?msync=error&reason=" + encodeURIComponent("You don't have any vehicles to sync"));
    }
    allowedIds = new Set(editable.map((vehicle) => vehicle.vehicle_id));
  }

  const result = await syncMonthlyGpsDistance(allowedIds);

  // Also fill in per-fill segment distances — these power the monthly & all-time
  // mileage figures. Best-effort: a segment failure shouldn't fail the whole sync.
  const seg = await syncFuelSegmentDistances(allowedIds);

  revalidatePath("/fuel");
  if (!result.ok) {
    redirect("/fuel?msync=error&reason=" + encodeURIComponent(result.reason ?? "unknown error"));
  }
  redirect(
    `/fuel?msync=ok&vehicles=${result.vehicles}&months=${result.months}&failed=${result.failed + seg.failed}` +
      `&segments=${seg.segments}&from=${encodeURIComponent(result.from ?? "")}&to=${encodeURIComponent(result.to ?? "")}`,
  );
}

const normReg = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// India is UTC+5:30. The provider summary endpoints cap how long a single window
// can be: a range longer than ~1 month returns HTTP 400 "Time period exceeds the
// limit" (verified live — a 31/32-day window works, ~40 days fails). Crossing a
// calendar-month boundary is itself fine; the duration cap is the real constraint.
// Splitting at IST month boundaries keeps every sub-window <= 31 days (a calendar
// month's max), safely under the cap, and per-window distances sum to the true
// total. Mirrors the month-by-month chunking in lib/gps-distance.ts.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Tile [fromMs, toMs] into contiguous windows (no gaps, no overlaps) that each
 * fall within a single IST calendar month — so each is at most 31 days, under the
 * provider's max-period cap — and summing their distances gives the whole-range
 * total.
 */
function istMonthWindows(fromMs: number, toMs: number): { fromMs: number; toMs: number }[] {
  const windows: { fromMs: number; toMs: number }[] = [];
  let cursor = fromMs;
  while (cursor < toMs) {
    const ist = new Date(cursor + IST_OFFSET_MS);
    const nextMonthStartMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 1) - IST_OFFSET_MS;
    const end = Math.min(nextMonthStartMs, toMs);
    windows.push({ fromMs: cursor, toMs: end });
    cursor = end;
  }
  return windows;
}

export type GpsDistanceResult =
  | { ok: true; km: number; registration: string }
  | { ok: false; error: string };

/**
 * On-demand GPS distance for one vehicle over an arbitrary date-time window.
 * Powers the /gps-distance calculator. Provider-aware (Millitrack/VehicleStep
 * by device id, WheelsEye by registration). Permission-scoped: the vehicle must
 * be one the caller can already see (getVehicles is permission-filtered), so a
 * circle/division user can't pull another location's data.
 *
 * Caller passes ISO timestamps computed in the browser (device timezone), so the
 * window is absolute and independent of the server's UTC clock.
 */
export async function getVehicleGpsDistanceAction(input: {
  vehicleId: string;
  fromISO: string;
  toISO: string;
}): Promise<GpsDistanceResult> {
  const profile = await requireProfile();

  const vehicleId = typeof input?.vehicleId === "string" ? input.vehicleId : "";
  const fromISO = typeof input?.fromISO === "string" ? input.fromISO : "";
  const toISO = typeof input?.toISO === "string" ? input.toISO : "";
  if (!vehicleId || !fromISO || !toISO) return { ok: false, error: "Vehicle aur dono date-time chuno." };

  const fromMs = Date.parse(fromISO);
  const toMs = Date.parse(toISO);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return { ok: false, error: "Date-time sahi nahi hai." };
  if (fromMs >= toMs) return { ok: false, error: "Start date-time, end se pehle hona chahiye." };

  // getVehicles is already permission-filtered, so finding the vehicle here is
  // both the lookup and the access check.
  const vehicles = await getVehicles(profile);
  const vehicle = vehicles.find((v) => v.vehicle_id === vehicleId);
  if (!vehicle) return { ok: false, error: "Ye vehicle nahi mila ya aapko iska access nahi hai." };

  // Split the range so no single provider call exceeds the API's ~1-month max
  // period (longer ranges return HTTP 400), then sum the per-window distances.
  const windows = istMonthWindows(fromMs, toMs);

  try {
    if (vehicle.gps_company === "VehicleStep") {
      const deviceId = String(vehicle.gps_device_id ?? "").trim();
      if (!/^\d+$/.test(deviceId)) return { ok: false, error: "Is vehicle pe valid GPS device mapped nahi hai." };
      if (!isMillitrackConfigured()) return { ok: false, error: "GPS provider (VehicleStep) abhi configured nahi hai." };

      let km = 0;
      for (const w of windows) {
        const rows = await millitrackSummary(deviceId, new Date(w.fromMs).toISOString(), new Date(w.toMs).toISOString());
        km += rows.reduce((sum, r) => sum + (r.distance ?? 0) / 1000, 0);
      }
      return { ok: true, km: +km.toFixed(2), registration: vehicle.registration_no };
    }

    if (vehicle.gps_company === "WheelsEye") {
      if (!isWheelsEyeConfigured()) return { ok: false, error: "GPS provider (WheelsEye) abhi configured nahi hai." };

      let km = 0;
      let hasData = false;
      for (const w of windows) {
        const kmByReg = await wheelsEyeDistanceByReg(Math.floor(w.fromMs / 1000), Math.floor(w.toMs / 1000));
        const part = kmByReg.get(normReg(vehicle.registration_no));
        if (part != null) {
          km += part;
          hasData = true;
        }
      }
      if (!hasData) return { ok: false, error: "Is range me is vehicle ka GPS data nahi mila." };
      return { ok: true, km: +km.toFixed(2), registration: vehicle.registration_no };
    }

    return { ok: false, error: "Is vehicle pe GPS device nahi laga hai." };
  } catch (e) {
    console.error("[gps-distance]", e instanceof Error ? e.message : e);
    return { ok: false, error: "GPS data laane me dikkat aayi. Thodi der baad dobara try karo." };
  }
}
