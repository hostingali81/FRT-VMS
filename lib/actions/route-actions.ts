"use server";

import { requireProfile } from "@/lib/auth";
import { getVehicleRoute } from "@/lib/route-history";
import type { VehicleRoute } from "@/lib/types";

/**
 * Permission-scoped route history for the /live/[vehicleId] replay map. Called by
 * the client when the user changes the date/time window; re-runs the same
 * permission filtering as the initial server render.
 */
export async function getVehicleRouteAction(input: {
  vehicleId: string;
  fromISO: string;
  toISO: string;
}): Promise<VehicleRoute> {
  const profile = await requireProfile();
  return getVehicleRoute(profile, input.vehicleId, input.fromISO, input.toISO);
}
