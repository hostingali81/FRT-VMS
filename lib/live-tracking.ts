// Server-only module: joins live GPS feeds (Millitrack + WheelsEye) to the
// permission-filtered VMS vehicles. Imported by the /live page and its refresh action.
import { getVehicles } from "@/lib/data";
import { getFleetLiveState, isMillitrackConfigured, type LiveDeviceState } from "@/lib/millitrack";
import { getWheelsEyeLiveState, isWheelsEyeConfigured, type WheelsEyeLiveState } from "@/lib/wheelseye";
import type {
  FleetLiveCounts,
  FleetLiveStatus,
  FleetVehicle,
  LiveProvider,
  LiveStatus,
  LiveVehicleStatus,
  UserProfile,
  VehicleLive,
} from "@/lib/types";

const emptyCounts = (): FleetLiveCounts => ({
  total: 0,
  running: 0,
  idle: 0,
  stopped: 0,
  inactive: 0,
  noData: 0,
  expired: 0,
  expiringSoon: 0,
});

// Cards are ordered by how much they need attention: moving first, parked last.
const STATUS_RANK: Record<LiveStatus, number> = {
  running: 0,
  idle: 1,
  stopped: 2,
  noData: 3,
  inactive: 4,
  expiringSoon: 5,
  expired: 6,
};

const normReg = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const isMtVehicle = (v: FleetVehicle) =>
  v.gps_company === "VehicleStep" && /^\d+$/.test(String(v.gps_device_id ?? "").trim());

function baseFields(v: FleetVehicle) {
  return {
    vehicle_id: v.vehicle_id,
    registration_no: v.registration_no,
    frt_no: v.frt_no,
    circle: v.current_circle ?? v.home_circle,
    division: v.division,
    substation: v.substation,
  };
}

// Mirrors VehicleLiveCard's fallback title: "<frt> <substation> (<registration>)".
function vehicleTitle(v: FleetVehicle): string {
  const prefix = [v.frt_no, v.substation].filter(Boolean).join(" ").trim();
  return prefix ? `${prefix} (${v.registration_no})` : v.registration_no;
}

// Normalise one provider device record into the unified LiveVehicleStatus shape.
// Shared by the fleet snapshot and the single-vehicle lookup so the two never drift.
function mtItem(v: FleetVehicle, dev: LiveDeviceState): LiveVehicleStatus {
  return {
    ...baseFields(v),
    provider: "VehicleStep",
    device_id: dev.deviceId,
    device_name: dev.name,
    category: dev.category,
    live_status: dev.status,
    speed_kmh: dev.speedKmh,
    latitude: dev.latitude,
    longitude: dev.longitude,
    address: dev.address,
    ignition: dev.ignition,
    charge: dev.charge,
    blocked: dev.blocked,
    today_distance_km: dev.todayDistanceKm,
    course: dev.course,
    last_update: dev.lastUpdate,
  };
}

function weItem(v: FleetVehicle, dev: WheelsEyeLiveState): LiveVehicleStatus {
  return {
    ...baseFields(v),
    provider: "WheelsEye",
    device_id: dev.vehicleId,
    device_name: null,
    category: null, // WheelsEye has no device category; markers fall back to truck
    live_status: dev.status,
    speed_kmh: dev.speedKmh,
    latitude: dev.latitude,
    longitude: dev.longitude,
    address: dev.address,
    ignition: dev.ignition,
    charge: null,
    blocked: dev.blocked,
    today_distance_km: dev.todayDistanceKm,
    course: dev.course,
    last_update: dev.lastUpdate,
  };
}

/**
 * Live snapshot for the caller's vehicles, across both GPS providers.
 * Permission-scoped: only vehicles the profile can see (via getVehicles) are
 * joined to the live feeds, and the bucket counts are computed over that visible
 * subset. Millitrack vehicles join by device id, WheelsEye by registration.
 * Providers are fetched independently — one failing doesn't drop the other.
 */
export async function getFleetLiveStatus(profile?: UserProfile | null): Promise<FleetLiveStatus> {
  const fetchedAt = new Date().toISOString();
  const mtConfigured = isMillitrackConfigured();
  const weConfigured = isWheelsEyeConfigured();

  if (!mtConfigured && !weConfigured) {
    return { configured: false, ok: false, error: "GPS provider not configured", counts: emptyCounts(), vehicles: [], untracked: 0, fetchedAt };
  }

  const vehicles = (await getVehicles(profile)).filter((v) => v.status !== "removed");
  const mtVehicles = vehicles.filter(isMtVehicle);
  const weVehicles = vehicles.filter((v) => v.gps_company === "WheelsEye" && v.registration_no);

  const needMt = mtVehicles.length > 0 && mtConfigured;
  const needWe = weVehicles.length > 0 && weConfigured;

  const [mtSettled, weSettled] = await Promise.allSettled([
    needMt ? getFleetLiveState() : Promise.resolve(null),
    // Only fetch telemetry for the registrations this profile can see, not the
    // whole WheelsEye account.
    needWe ? getWheelsEyeLiveState(weVehicles.map((v) => v.registration_no)) : Promise.resolve(null),
  ]);

  const errors: string[] = [];
  const mtState = mtSettled.status === "fulfilled" ? mtSettled.value : (errors.push("Millitrack"), null);
  const weState = weSettled.status === "fulfilled" ? weSettled.value : (errors.push("WheelsEye"), null);

  const counts = emptyCounts();
  const items: LiveVehicleStatus[] = [];
  let untracked = 0;

  // ── Millitrack (join by device id) ──
  for (const v of mtVehicles) {
    const dev = mtState?.byDeviceId.get(Number(v.gps_device_id));
    if (!dev) {
      if (needMt) untracked += 1;
      continue;
    }
    counts[dev.status] += 1;
    counts.total += 1;
    items.push(mtItem(v, dev));
  }

  // ── WheelsEye (join by registration) ──
  for (const v of weVehicles) {
    const dev = weState?.get(normReg(v.registration_no));
    if (!dev) {
      if (needWe) untracked += 1;
      continue;
    }
    counts[dev.status] += 1;
    counts.total += 1;
    items.push(weItem(v, dev));
  }

  items.sort((a, b) => {
    const rank = STATUS_RANK[a.live_status] - STATUS_RANK[b.live_status];
    if (rank !== 0) return rank;
    const sa = a.speed_kmh ?? -1;
    const sb = b.speed_kmh ?? -1;
    if (sb !== sa) return sb - sa;
    return a.registration_no.localeCompare(b.registration_no);
  });

  const ok = (!needMt || !!mtState) && (!needWe || !!weState);
  return {
    configured: true,
    ok,
    error: ok ? undefined : `Couldn't reach: ${errors.join(", ")}`,
    counts,
    vehicles: items,
    untracked,
    fetchedAt,
  };
}

/**
 * Current/last live position for ONE of the caller's vehicles — backs the
 * default view of /live/[vehicleId] (shown before any route is requested).
 * Permission-scoped via getVehicles. Hits only the provider this vehicle uses:
 * Millitrack's fleet state (one bulk call) or a single-registration WheelsEye
 * lookup. `live: null` means the vehicle is mapped but isn't reporting right now.
 */
export async function getVehicleLiveStatus(
  profile: UserProfile | null | undefined,
  vehicleId: string,
): Promise<VehicleLive> {
  const fetchedAt = new Date().toISOString();
  const mtConfigured = isMillitrackConfigured();
  const weConfigured = isWheelsEyeConfigured();
  const configured = mtConfigured || weConfigured;

  const vehicles = await getVehicles(profile);
  const v = vehicles.find((x) => x.vehicle_id === vehicleId);

  if (!v) {
    return {
      ok: false,
      configured,
      error: "Vehicle not found or you don't have access to it.",
      vehicle: { vehicle_id: vehicleId, registration_no: "", frt_no: null, substation: null, title: "Vehicle", provider: null },
      live: null,
      fetchedAt,
    };
  }

  const provider: LiveProvider | null =
    v.gps_company === "WheelsEye" ? "WheelsEye" : isMtVehicle(v) ? "VehicleStep" : null;
  const meta = {
    vehicle_id: v.vehicle_id,
    registration_no: v.registration_no,
    frt_no: v.frt_no,
    substation: v.substation,
    title: vehicleTitle(v),
    provider,
  };

  try {
    if (v.gps_company === "WheelsEye") {
      if (!weConfigured) throw new Error("WheelsEye GPS is not configured.");
      const state = await getWheelsEyeLiveState([v.registration_no]);
      const dev = state.get(normReg(v.registration_no));
      return { ok: true, configured, vehicle: meta, live: dev ? weItem(v, dev) : null, fetchedAt };
    }

    if (!isMtVehicle(v)) throw new Error("This vehicle has no GPS device mapped.");
    if (!mtConfigured) throw new Error("Millitrack GPS is not configured.");
    const state = await getFleetLiveState();
    const dev = state.byDeviceId.get(Number(v.gps_device_id));
    return { ok: true, configured, vehicle: meta, live: dev ? mtItem(v, dev) : null, fetchedAt };
  } catch (e) {
    return {
      ok: false,
      configured,
      error: e instanceof Error ? e.message : "Couldn't load live location.",
      vehicle: meta,
      live: null,
      fetchedAt,
    };
  }
}
