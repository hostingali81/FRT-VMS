// Server-only module: resolves a vehicle's travelled route from the right GPS
// provider for the /live/[vehicleId] replay map. Imported only by server actions
// and the route page. Permission-scoped via getVehicles (same as the live feed).
import { getVehicles } from "@/lib/data";
import { isMillitrackConfigured, millitrackRoute } from "@/lib/millitrack";
import { isWheelsEyeConfigured, wheelsEyeRoute, wheelsEyeVehicleIdForReg } from "@/lib/wheelseye";
import type { FleetVehicle, UserProfile, VehicleRoute } from "@/lib/types";

// Mirrors VehicleLiveCard's title: "<frt> <substation> (<registration>)".
function vehicleTitle(v: FleetVehicle): string {
  const prefix = [v.frt_no, v.substation].filter(Boolean).join(" ").trim();
  return prefix ? `${prefix} (${v.registration_no})` : v.registration_no;
}

const isMtVehicle = (v: FleetVehicle) =>
  v.gps_company === "VehicleStep" && /^\d+$/.test(String(v.gps_device_id ?? "").trim());

/**
 * Travelled route + stops for one of the caller's vehicles over [fromISO, toISO].
 * Branches on gps_company: VehicleStep → Millitrack, WheelsEye → WheelsEye. Always
 * returns a VehicleRoute (ok:false carries the reason) so the UI can render a state.
 */
export async function getVehicleRoute(
  profile: UserProfile | null | undefined,
  vehicleId: string,
  fromISO: string,
  toISO: string,
): Promise<VehicleRoute> {
  const vehicles = await getVehicles(profile);
  const vehicle = vehicles.find((v) => v.vehicle_id === vehicleId);

  if (!vehicle) {
    return {
      ok: false,
      error: "Vehicle not found or you don't have access to it.",
      provider: null,
      vehicle: { vehicle_id: vehicleId, registration_no: "", frt_no: null, substation: null, title: "Vehicle" },
      points: [],
      stops: [],
      totalDistanceKm: 0,
      fromISO,
      toISO,
    };
  }

  const meta = {
    vehicle_id: vehicle.vehicle_id,
    registration_no: vehicle.registration_no,
    frt_no: vehicle.frt_no,
    substation: vehicle.substation,
    title: vehicleTitle(vehicle),
  };
  const provider = vehicle.gps_company === "WheelsEye" ? "WheelsEye" : "VehicleStep";

  try {
    if (vehicle.gps_company === "WheelsEye") {
      if (!isWheelsEyeConfigured()) throw new Error("WheelsEye GPS is not configured.");
      const id = await wheelsEyeVehicleIdForReg(vehicle.registration_no);
      if (id == null) throw new Error("This vehicle isn't linked on WheelsEye.");
      const route = await wheelsEyeRoute(id, Math.floor(Date.parse(fromISO) / 1000), Math.floor(Date.parse(toISO) / 1000));
      return { ok: true, provider, vehicle: meta, ...route, fromISO, toISO };
    }

    if (!isMtVehicle(vehicle)) throw new Error("This vehicle has no GPS device mapped.");
    if (!isMillitrackConfigured()) throw new Error("Millitrack GPS is not configured.");
    const route = await millitrackRoute(String(vehicle.gps_device_id), fromISO, toISO);
    return { ok: true, provider, vehicle: meta, ...route, fromISO, toISO };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't load the route.",
      provider,
      vehicle: meta,
      points: [],
      stops: [],
      totalDistanceKm: 0,
      fromISO,
      toISO,
    };
  }
}
