"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isMillitrackConfigured, millitrackSummary } from "@/lib/millitrack";
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
 * Sync monthly GPS distance for every GPS-mapped vehicle (independent of fuel logs).
 * Builds month-wise history in vehicle_gps_distance. super_admin only.
 */
export async function syncGpsMonthlyDistanceAction() {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") {
    throw new Error("Unauthorized: only super_admin can sync GPS distance");
  }

  const result = await syncMonthlyGpsDistance();

  revalidatePath("/fuel");
  if (!result.ok) {
    redirect("/fuel?msync=error&reason=" + encodeURIComponent(result.reason ?? "unknown error"));
  }
  redirect(
    `/fuel?msync=ok&vehicles=${result.vehicles}&months=${result.months}&failed=${result.failed}` +
      `&from=${encodeURIComponent(result.from ?? "")}&to=${encodeURIComponent(result.to ?? "")}`,
  );
}
