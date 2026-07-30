"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { applyMillitrackNames } from "@/lib/device-naming";

/**
 * Push the VMS naming onto the Millitrack devices (the /vehicles/gps-names page).
 *
 * super_admin only: this writes to the GPS platform for the WHOLE fleet at once
 * and there is no undo, so it stays with the one role that owns the fleet-wide
 * master data — unlike the distance sync, which circle/division incharges can run
 * for their own vehicles.
 */
export async function applyMillitrackNamesAction() {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") {
    throw new Error("Unauthorized: only a super admin can rename GPS devices");
  }

  const result = await applyMillitrackNames(profile);

  revalidatePath("/vehicles/gps-names");
  if (!result.ok) {
    redirect(`/vehicles/gps-names?error=${encodeURIComponent(result.error ?? "unknown error")}`);
  }

  const failures = result.failures.length
    ? `&failedRegs=${encodeURIComponent(result.failures.map((f) => f.registration_no).join(", "))}`
    : "";
  redirect(`/vehicles/gps-names?renamed=${result.renamed}&failed=${result.failed}${failures}`);
}
