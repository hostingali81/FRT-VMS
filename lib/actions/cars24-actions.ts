"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getAllLookups, getVehicles } from "@/lib/data";
import { canEditVehicle } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { extractRtoDocuments, fetchCars24Detail, hasCars24Data } from "@/lib/cars24";

// How many Cars24 calls to run at once. Bounded so a large fleet stays within
// the route's maxDuration without hammering the upstream API.
const CONCURRENCY = 6;

/**
 * Refresh vehicle document expiry dates (insurance / fitness / pollution) from
 * Cars24's public RTO API for every vehicle the caller can edit.
 *
 * Permission-scoped: only vehicles passing canEditVehicle are touched, so a
 * circle/division incharge refreshes only their own vehicles. Only valid dates
 * that differ from the stored value are written — blanks and unchanged values
 * are never re-saved. Idempotent: re-running only updates what changed, and
 * vehicles Cars24 has no record for are simply counted and skipped.
 */
export async function refreshRtoDocumentsAction() {
  const profile = await requireProfile();
  const lookups = await getAllLookups();

  const vehicles = await getVehicles(profile);
  const editable = vehicles.filter(
    (vehicle) => vehicle.status !== "removed" && canEditVehicle(profile, vehicle, lookups),
  );

  if (editable.length === 0) {
    redirect(
      "/alerts?rto=error&rtoReason=" +
        encodeURIComponent("You don't have any vehicles to refresh"),
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    redirect("/alerts?rto=error&rtoReason=" + encodeURIComponent("Database connection not available"));
  }

  let updated = 0;
  let unchanged = 0;
  let noData = 0;
  let failed = 0;
  const failureReasons: string[] = [];

  for (let i = 0; i < editable.length; i += CONCURRENCY) {
    const batch = editable.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (vehicle) => {
        try {
          const detail = await fetchCars24Detail(vehicle.registration_no);
          if (!hasCars24Data(detail)) {
            noData += 1;
            return;
          }

          const docs = extractRtoDocuments(detail);
          const update: Record<string, string> = {};
          if (docs.insurance_expiry && docs.insurance_expiry !== vehicle.insurance_expiry) {
            update.insurance_expiry = docs.insurance_expiry;
          }
          if (docs.fitness_expiry && docs.fitness_expiry !== vehicle.fitness_expiry) {
            update.fitness_expiry = docs.fitness_expiry;
          }
          if (docs.pollution_expiry && docs.pollution_expiry !== vehicle.pollution_expiry) {
            update.pollution_expiry = docs.pollution_expiry;
          }

          if (Object.keys(update).length === 0) {
            unchanged += 1;
            return;
          }

          const { error } = await supabase.from("vehicles").update(update).eq("id", vehicle.vehicle_id);
          if (error) throw new Error(error.message);
          updated += 1;
        } catch (e) {
          const message = e instanceof Error ? `${e.name === "TimeoutError" ? "timed out" : e.message}` : String(e);
          console.error(`[cars24] ${vehicle.registration_no}:`, message);
          failureReasons.push(message);
          failed += 1;
        }
      }),
    );
  }

  revalidatePath("/alerts");
  revalidatePath("/vehicles");
  revalidatePath("/dashboard");
  // Surface the most common failure reason so the banner says WHY calls failed
  // (e.g. "timed out" vs "non-JSON response (HTTP 403)"), not just how many.
  const reasonParam =
    failed > 0 && failureReasons.length > 0
      ? `&rtoReason=${encodeURIComponent(mostCommon(failureReasons).slice(0, 120))}`
      : "";
  // Params are rto-prefixed so they never collide with the generic toast params
  // (a bare `updated=0` would fire the "Vehicle updated" success toast).
  redirect(
    `/alerts?rto=ok&rtoChecked=${editable.length}&rtoUpdated=${updated}` +
      `&rtoUnchanged=${unchanged}&rtoNodata=${noData}&rtoFailed=${failed}${reasonParam}`,
  );
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}
