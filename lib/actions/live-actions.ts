"use server";

import { requireProfile } from "@/lib/auth";
import { getFleetLiveStatus } from "@/lib/live-tracking";
import type { FleetLiveStatus } from "@/lib/types";

/**
 * Permission-scoped live fleet snapshot for the /live page's auto-refresh.
 * Called by the client on an interval (via SWR); re-runs the same permission
 * filtering as the initial server render so a user only ever sees their fleet.
 */
export async function getFleetLiveStatusAction(): Promise<FleetLiveStatus> {
  const profile = await requireProfile();
  return getFleetLiveStatus(profile);
}
