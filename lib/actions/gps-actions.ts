"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isMillitrackConfigured, millitrackLogin, millitrackSummary } from "@/lib/millitrack";

/**
 * Sync per-fill-up GPS distance from Millitrack into vehicle_fuel_logs.
 *
 * For each company vehicle that has a gps_device_id:
 *   - fetch its fuel logs in date order
 *   - pull daily distance from Millitrack for the whole span (1 API call/vehicle)
 *   - for each consecutive pair of fills, gps_distance_km of the later fill =
 *     sum of daily distance for the days driven since the previous fill
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
    redirect("/fuel?sync=error&reason=" + encodeURIComponent("MT_EMAIL / MT_PASSWORD not configured on the server"));
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

  let cookie: string;
  try {
    cookie = await millitrackLogin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Millitrack login failed";
    redirect("/fuel?sync=error&reason=" + encodeURIComponent(msg));
  }

  const nowISO = new Date().toISOString();
  let vehiclesSynced = 0;
  let segmentsUpdated = 0;
  let failed = 0;

  for (const vehicle of candidates) {
    try {
      const { data: logs } = await supabase
        .from("vehicle_fuel_logs")
        .select("id,log_date")
        .eq("vehicle_id", vehicle.id)
        .order("log_date", { ascending: true });

      if (!logs || logs.length < 2) continue; // need at least two fills for a segment

      const firstDate = logs[0].log_date as string;
      const rows = await millitrackSummary(
        cookie,
        String(vehicle.gps_device_id),
        `${firstDate}T00:00:00.000Z`,
        nowISO,
        true, // daily
      );

      // Map day (YYYY-MM-DD) → distance in km
      const kmByDay: Record<string, number> = {};
      for (const row of rows) {
        if (!row.startTime) continue;
        const day = row.startTime.slice(0, 10);
        kmByDay[day] = (kmByDay[day] ?? 0) + (row.distance ?? 0) / 1000;
      }

      let vehicleTouched = false;
      for (let i = 1; i < logs.length; i++) {
        const prevDate = logs[i - 1].log_date as string;
        const currDate = logs[i].log_date as string;

        let segmentKm = 0;
        for (const day of Object.keys(kmByDay)) {
          if (day > prevDate && day <= currDate) segmentKm += kmByDay[day];
        }

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
