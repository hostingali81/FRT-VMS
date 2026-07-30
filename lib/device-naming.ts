// Server-only module: keeps the Millitrack device names in sync with the VMS.
// Imported by the /vehicles/gps-names preview page and its apply action.
//
// The platform's device `name` is what shows on the GPS dashboard and in its
// reports, so it should read the same as the VMS record. Only Millitrack supports
// renaming (see renameMillitrackDevice) — WheelsEye has no such endpoint, so its
// vehicles are out of scope here.
import { getVehicles } from "@/lib/data";
import { getDevices, isMillitrackConfigured, renameMillitrackDevice, type Device } from "@/lib/millitrack";
import type { FleetVehicle, UserProfile, VehicleStatus } from "@/lib/types";

export type DeviceNameRow = {
  vehicle_id: string;
  registration_no: string;
  frt_no: string | null;
  substation: string | null;
  status: VehicleStatus;
  device_id: number;
  currentName: string;
  targetName: string;
  changed: boolean;
};

export type DeviceNamePlan = {
  ok: boolean;
  error?: string;
  rows: DeviceNameRow[]; // every mapped vehicle, changed ones first
  changed: number;
  unchanged: number;
  /** Vehicles on VehicleStep whose gps_device_id isn't on the Millitrack account. */
  missingOnMillitrack: number;
  /** Devices on the account no VMS vehicle points at — never touched. */
  unmappedDevices: number;
};

export type DeviceNameApplyResult = {
  ok: boolean;
  error?: string;
  renamed: number;
  failed: number;
  failures: { registration_no: string; reason: string }[];
};

const isMtVehicle = (v: FleetVehicle) =>
  v.gps_company === "VehicleStep" && /^\d+$/.test(String(v.gps_device_id ?? "").trim());

/**
 * The name a vehicle's GPS device should carry.
 *
 * Active vehicles get the full deployment label — "FRT 9 CHANDAULI (UP32PN7247)".
 * Anything not active (removed / standby / accident) is deliberately stripped back
 * to just the registration: its FRT number and substation belong to whichever
 * vehicle is actually deployed there now, so leaving them on would double up.
 */
export function millitrackDeviceName(vehicle: {
  registration_no: string;
  frt_no: string | null;
  substation: string | null;
  status: VehicleStatus;
}): string {
  const registration = vehicle.registration_no.trim();
  if (vehicle.status !== "active") return registration;

  const prefix = [vehicle.frt_no?.trim(), vehicle.substation?.trim()].filter(Boolean).join(" ");
  return prefix ? `${prefix} (${registration})` : registration;
}

/**
 * What a rename run would do, without touching anything. Permission-scoped through
 * getVehicles, though only super_admin reaches this (the action gates on the role).
 */
export async function planMillitrackNames(profile?: UserProfile | null): Promise<DeviceNamePlan> {
  const empty = { rows: [], changed: 0, unchanged: 0, missingOnMillitrack: 0, unmappedDevices: 0 };
  if (!isMillitrackConfigured()) return { ok: false, error: "VehicleStep (Millitrack) GPS is not configured.", ...empty };

  let devices: Device[];
  try {
    devices = await getDevices();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't reach Millitrack.", ...empty };
  }

  const byId = new Map(devices.map((d) => [d.id, d]));
  const vehicles = (await getVehicles(profile)).filter(isMtVehicle);

  const rows: DeviceNameRow[] = [];
  let missingOnMillitrack = 0;
  for (const v of vehicles) {
    const deviceId = Number(v.gps_device_id);
    const device = byId.get(deviceId);
    if (!device) {
      missingOnMillitrack += 1;
      continue;
    }
    const currentName = (device.name ?? "").trim();
    const targetName = millitrackDeviceName(v);
    rows.push({
      vehicle_id: v.vehicle_id,
      registration_no: v.registration_no,
      frt_no: v.frt_no,
      substation: v.substation,
      status: v.status,
      device_id: deviceId,
      currentName,
      targetName,
      changed: currentName !== targetName,
    });
  }

  // Changed rows first so the preview leads with what will actually happen; within
  // a group keep FRT order (FRT 2 before FRT 10), unnumbered last.
  const frtRank = (frt: string | null) => {
    const m = frt?.match(/\d+/);
    return m ? parseInt(m[0], 10) : Number.POSITIVE_INFINITY;
  };
  rows.sort((a, b) => {
    if (a.changed !== b.changed) return a.changed ? -1 : 1;
    const fa = frtRank(a.frt_no);
    const fb = frtRank(b.frt_no);
    if (fa !== fb) return fa - fb;
    return a.registration_no.localeCompare(b.registration_no);
  });

  const claimed = new Set(rows.map((r) => r.device_id));
  return {
    ok: true,
    rows,
    changed: rows.filter((r) => r.changed).length,
    unchanged: rows.filter((r) => !r.changed).length,
    missingOnMillitrack,
    unmappedDevices: devices.filter((d) => !claimed.has(d.id)).length,
  };
}

// Renames go one at a time with a small gap — this is a bulk write to someone
// else's platform, so we stay well clear of anything that looks like a flood.
const RENAME_GAP_MS = 400;

/**
 * Apply the plan: rename only the devices whose name differs. Re-plans internally
 * so the writes are based on state read moments earlier, not on a stale preview.
 * A per-device failure is recorded and the run continues.
 */
export async function applyMillitrackNames(profile?: UserProfile | null): Promise<DeviceNameApplyResult> {
  const plan = await planMillitrackNames(profile);
  if (!plan.ok) return { ok: false, error: plan.error, renamed: 0, failed: 0, failures: [] };

  const pending = plan.rows.filter((r) => r.changed);
  if (!pending.length) return { ok: true, renamed: 0, failed: 0, failures: [] };

  // The device objects carry the category/contact that must survive the rename.
  const byId = new Map((await getDevices()).map((d) => [d.id, d]));

  let renamed = 0;
  const failures: { registration_no: string; reason: string }[] = [];
  for (const row of pending) {
    const device = byId.get(row.device_id);
    if (!device) {
      failures.push({ registration_no: row.registration_no, reason: "Device no longer on the account" });
      continue;
    }
    try {
      await renameMillitrackDevice(device, row.targetName);
      renamed += 1;
    } catch (e) {
      console.error(`[device-naming] ${row.registration_no} (${row.device_id}):`, e instanceof Error ? e.message : e);
      failures.push({ registration_no: row.registration_no, reason: e instanceof Error ? e.message : "Unknown error" });
    }
    await new Promise((resolve) => setTimeout(resolve, RENAME_GAP_MS));
  }

  return { ok: true, renamed, failed: failures.length, failures };
}
