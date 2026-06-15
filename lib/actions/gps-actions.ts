"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getAllLookups, getVehicles } from "@/lib/data";
import { canCreateVehicle, canEditVehicle } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isMillitrackConfigured, millitrackSummary } from "@/lib/millitrack";
import { isWheelsEyeConfigured, wheelsEyeDistanceByReg } from "@/lib/wheelseye";
import { syncMonthlyGpsDistance } from "@/lib/gps-distance";

/**
 * Sync per-fill-up GPS distance from Millitrack into vehicle_fuel_logs.
 *
 * For each company vehicle that has a gps_device_id:
 *   - fetch its fuel logs in date order
 *   - for each consecutive pair of fills, gps_distance_km of the later fill =
 *     Millitrack distance over that segment's date range (1 API call/segment)
 *
 * The track4 API ignores daily=true and only returns one aggregate row per
 * [from, to] window, so we query each segment's range directly — the aggregate
 * distance for that window IS the segment distance. Segments that already have
 * gps_distance_km are skipped (a closed segment never changes), so repeat runs
 * only compute new fills.
 *
 * Average (km/L) is then gps_distance_km / fuel_litres, computed in the UI.
 * super_admin only.
 */
export async function syncGpsDistanceAction() {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") {
    throw new Error("Unauthorized: only super_admin can sync GPS distance");
  }

  if (!isMillitrackConfigured()) {
    redirect(
      "/fuel?sync=error&reason=" +
        encodeURIComponent("Millitrack not configured (set MT_USERNAME + MT_PASSWORD, or MT_TOKEN)"),
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    redirect("/fuel?sync=error&reason=" + encodeURIComponent("Database connection not available"));
  }

  // Company vehicles with a GPS device mapped
  const { data: vehicles, error: vErr } = await supabase
    .from("vehicles")
    .select("id,registration_no,gps_device_id,fuel_ownership")
    .eq("fuel_ownership", "company")
    .not("gps_device_id", "is", null);

  if (vErr) throw new Error("Failed to load vehicles: " + vErr.message);

  const candidates = (vehicles ?? []).filter(
    (v) => v.gps_device_id && /^\d+$/.test(String(v.gps_device_id).trim()),
  );

  const nowISO = new Date().toISOString();
  let vehiclesSynced = 0;
  let segmentsUpdated = 0;
  let failed = 0;

  for (const vehicle of candidates) {
    try {
      const { data: logs } = await supabase
        .from("vehicle_fuel_logs")
        .select("id,log_date,gps_distance_km")
        .eq("vehicle_id", vehicle.id)
        .order("log_date", { ascending: true });

      if (!logs || logs.length < 2) continue; // need at least two fills for a segment

      let vehicleTouched = false;
      for (let i = 1; i < logs.length; i++) {
        // A closed segment's distance never changes, so skip ones already synced.
        if (logs[i].gps_distance_km != null) continue;

        const prevDate = logs[i - 1].log_date as string;
        const currDate = logs[i].log_date as string;

        const rows = await millitrackSummary(
          String(vehicle.gps_device_id),
          `${prevDate}T00:00:00.000Z`,
          `${currDate}T00:00:00.000Z`,
        );
        const segmentKm = rows.reduce((sum, r) => sum + (r.distance ?? 0) / 1000, 0);

        const { error: upErr } = await supabase
          .from("vehicle_fuel_logs")
          .update({ gps_distance_km: +segmentKm.toFixed(2), gps_synced_at: nowISO })
          .eq("id", logs[i].id);

        if (upErr) throw new Error(upErr.message);
        segmentsUpdated += 1;
        vehicleTouched = true;
      }

      if (vehicleTouched) vehiclesSynced += 1;
    } catch (e) {
      console.error(`[gps-sync] ${vehicle.registration_no}:`, e instanceof Error ? e.message : e);
      failed += 1;
    }
  }

  revalidatePath("/fuel");
  redirect(
    `/fuel?sync=ok&vehicles=${vehiclesSynced}&segments=${segmentsUpdated}&failed=${failed}` +
      `&skipped=${candidates.length === 0 ? 1 : 0}`,
  );
}

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

  revalidatePath("/fuel");
  if (!result.ok) {
    redirect("/fuel?msync=error&reason=" + encodeURIComponent(result.reason ?? "unknown error"));
  }
  redirect(
    `/fuel?msync=ok&vehicles=${result.vehicles}&months=${result.months}&failed=${result.failed}` +
      `&from=${encodeURIComponent(result.from ?? "")}&to=${encodeURIComponent(result.to ?? "")}`,
  );
}

const normReg = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

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

  try {
    if (vehicle.gps_company === "VehicleStep") {
      const deviceId = String(vehicle.gps_device_id ?? "").trim();
      if (!/^\d+$/.test(deviceId)) return { ok: false, error: "Is vehicle pe valid GPS device mapped nahi hai." };
      if (!isMillitrackConfigured()) return { ok: false, error: "GPS provider (VehicleStep) abhi configured nahi hai." };

      const rows = await millitrackSummary(deviceId, fromISO, toISO);
      const km = rows.reduce((sum, r) => sum + (r.distance ?? 0) / 1000, 0);
      return { ok: true, km: +km.toFixed(2), registration: vehicle.registration_no };
    }

    if (vehicle.gps_company === "WheelsEye") {
      if (!isWheelsEyeConfigured()) return { ok: false, error: "GPS provider (WheelsEye) abhi configured nahi hai." };

      const kmByReg = await wheelsEyeDistanceByReg(Math.floor(fromMs / 1000), Math.floor(toMs / 1000));
      const km = kmByReg.get(normReg(vehicle.registration_no));
      if (km == null) return { ok: false, error: "Is range me is vehicle ka GPS data nahi mila." };
      return { ok: true, km: +km.toFixed(2), registration: vehicle.registration_no };
    }

    return { ok: false, error: "Is vehicle pe GPS device nahi laga hai." };
  } catch (e) {
    console.error("[gps-distance]", e instanceof Error ? e.message : e);
    return { ok: false, error: "GPS data laane me dikkat aayi. Thodi der baad dobara try karo." };
  }
}
