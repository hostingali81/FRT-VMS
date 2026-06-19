/**
 * Millitrack GPS platform client (Android backend API). Server-only — call only from server actions.
 *
 * Uses the Millitrack Android app's internal API at http://track4.millitrack.com,
 * which authenticates with a JWT token sent in the `x-auth-token` header.
 *
 * TOKEN HANDLING (automatic):
 *   You do NOT need to capture or set a token by hand. On first use the client
 *   logs in with username/password (POST /api/session) and reads the JWT from the
 *   response body's `token` field, then caches it in memory. If a request later
 *   comes back 401/403 (token rejected), it logs in again and retries once.
 *   The Millitrack JWT has no `exp` claim, so the same long-lived token is reused
 *   until the server rejects it — no time-based refresh needed.
 *
 * Required env vars (either auto-login OR a fixed token):
 *   MT_USERNAME (or MT_EMAIL) + MT_PASSWORD  — used to auto-generate the JWT
 *   MT_TOKEN (optional)                       — fixed JWT override; if set, used as-is
 *   MT_USER_ID (optional)                     — account user id; only needed alongside
 *                                               a fixed MT_TOKEN, since the live-state
 *                                               endpoint is keyed by user id. With
 *                                               auto-login the id comes from the login body.
 *   MT_BASE_URL (optional)                    — defaults to http://track4.millitrack.com
 *
 * NOTE: track4 is HTTP (no SSL). The login `username` is the account username
 * (e.g. "imperial.barabanki"), which may differ from the email used by the old
 * web dashboard (mvts4.millitrack.com).
 */

import type { LiveStatus, ProviderRoute } from "@/lib/types";

const BASE = process.env.MT_BASE_URL ?? "http://track4.millitrack.com";
const APP_ID = "in.vehiclestep.vehiclesteppro.gpstracker";
const KNOTS_TO_KMH = 1.852;

/** In-memory JWT cache. Persists across requests within a warm server instance. */
let cachedToken: string | null = null;

/**
 * In-memory account user id, learned from the login response body (field `id`).
 * The live-state endpoint is keyed by it. The fixed-token path can't learn it, so
 * MT_USER_ID supplies it there.
 */
let cachedUserId: number | null = null;

export function isMillitrackConfigured() {
  if (process.env.MT_TOKEN) return true;
  const username = process.env.MT_USERNAME || process.env.MT_EMAIL;
  return Boolean(username && process.env.MT_PASSWORD);
}

/**
 * Log in with username/password and return a fresh JWT.
 * The token comes back in the JSON response body as `token`.
 */
export async function millitrackLogin(): Promise<string> {
  const username = process.env.MT_USERNAME || process.env.MT_EMAIL;
  const password = process.env.MT_PASSWORD;
  if (!username || !password) {
    throw new Error("MT_USERNAME (or MT_EMAIL) / MT_PASSWORD env vars are not set");
  }

  const url = `${BASE}/api/session?app=${encodeURIComponent(APP_ID)}&dc=${Date.now()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ username, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Millitrack login failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json().catch(() => null)) as { token?: string; id?: number } | null;
  if (!data?.token) throw new Error("Millitrack login succeeded but no token in response");
  if (typeof data.id === "number") cachedUserId = data.id; // learn the account user id
  return data.token;
}

/** Resolve a usable JWT: fixed MT_TOKEN override, else cached, else fresh login. */
async function getToken(forceRefresh = false): Promise<string> {
  if (process.env.MT_TOKEN) return process.env.MT_TOKEN; // explicit override always wins
  if (!forceRefresh && cachedToken) return cachedToken;
  cachedToken = await millitrackLogin();
  return cachedToken;
}

/**
 * Resolve the account user id (the live-state endpoint is keyed by it).
 * Prefers MT_USER_ID; otherwise uses the id learned at login. With a fixed
 * MT_TOKEN and no MT_USER_ID we never log in, so the id can't be discovered.
 */
async function getUserId(): Promise<number> {
  const envId = process.env.MT_USER_ID;
  if (envId && /^\d+$/.test(envId)) return Number(envId);
  if (cachedUserId != null) return cachedUserId;
  cachedToken = await millitrackLogin(); // also populates cachedUserId
  if (cachedUserId == null) {
    throw new Error("Millitrack user id unavailable; set MT_USER_ID for the fixed-token path");
  }
  return cachedUserId;
}

/**
 * Fetch a Millitrack API path with the JWT attached. On a 401/403 (token rejected)
 * it re-logs in once and retries — unless a fixed MT_TOKEN is in use, which we
 * can't refresh.
 */
async function authedFetch(path: string): Promise<Response> {
  const token = await getToken();
  const doFetch = (t: string) =>
    fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json", "x-auth-token": t },
      cache: "no-store",
    });

  let res = await doFetch(token);
  if ((res.status === 401 || res.status === 403) && !process.env.MT_TOKEN) {
    cachedToken = null;
    res = await doFetch(await getToken(true));
  }
  return res;
}

export type Device = {
  id: number;
  name?: string;
  uniqueId?: string;
  status?: string;
};

export type SummaryRow = {
  deviceId: number;
  deviceName?: string;
  distance: number; // meters
  averageSpeed?: number; // knots
  maxSpeed?: number; // knots
  spentFuel?: number; // litres
  engineHours?: number; // ms
  startOdometer?: number; // meters
  endOdometer?: number; // meters
  startTime?: string; // ISO
  endTime?: string; // ISO
};

/**
 * Normalize a raw summary object into our SummaryRow shape. The Android API uses
 * some richer field names (distanceTravelled, mileageFuelConsumed, firstIgnitionOnTime),
 * so we accept those as aliases for the classic Traccar fields the app already relies on.
 */
function normalizeSummary(raw: Record<string, unknown>): SummaryRow {
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    deviceId: num(raw.deviceId) ?? 0,
    deviceName: str(raw.deviceName),
    distance: num(raw.distance) ?? num(raw.distanceTravelled) ?? 0,
    averageSpeed: num(raw.averageSpeed),
    maxSpeed: num(raw.maxSpeed),
    spentFuel: num(raw.spentFuel) ?? num(raw.mileageFuelConsumed),
    engineHours: num(raw.engineHours),
    startOdometer: num(raw.startOdometer),
    endOdometer: num(raw.endOdometer),
    startTime: str(raw.startTime) ?? str(raw.firstIgnitionOnTime),
    endTime: str(raw.endTime) ?? str(raw.lastIgnitionOffTime),
  };
}

/** All GPS devices/vehicles linked to the account. */
export async function getDevices(): Promise<Device[]> {
  const res = await authedFetch("/api/devices");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Millitrack devices failed (${res.status}): ${body.slice(0, 160)}`);
  }
  return (await res.json()) as Device[];
}

/**
 * Distance summary for a single device over a date range.
 *
 * NOTE: the track4 API ignores Traccar's `daily=true` (verified) — it always
 * returns ONE aggregate row for the whole [from, to] window. So to get distance
 * per fuel segment, call this once per segment with that segment's date range
 * rather than trying to slice a daily breakdown.
 */
export async function millitrackSummary(
  deviceId: string | number,
  fromISO: string,
  toISO: string,
): Promise<SummaryRow[]> {
  const params = new URLSearchParams({ from: fromISO, to: toISO, mail: "false" });
  params.append("deviceId", String(deviceId));

  // Extra params the Android app sends. 0 = full day (no time-of-day filter).
  params.set("startHour", "0");
  params.set("startMinute", "0");
  params.set("endHour", "0");
  params.set("endMinute", "0");
  params.set("useTimeAsInterval", "false");
  params.set("dc", String(Date.now())); // cache buster

  const res = await authedFetch(`/api/reports/summary?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Millitrack summary failed for device ${deviceId} (${res.status}): ${body.slice(0, 160)}`);
  }
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows.map(normalizeSummary);
}

// ── Route history (replay) ───────────────────────────────────────────────────
// The mvts4 web player and the Android app both read /api/reports/routeWithStops,
// which returns the travelled path (onlyMovingPositionList), the parked segments
// (stopDataList) and the total distance — exactly what the replay map needs.

type RawPosition = {
  latitude?: number;
  longitude?: number;
  speed?: number; // knots
  course?: number;
  fixTime?: string;
  deviceTime?: string;
  address?: string;
};
type RawStop = {
  stopPosition?: RawPosition;
  startPosition?: RawPosition;
  stopDuration?: number; // ms
};
type RawRouteWithStops = {
  onlyMovingPositionList?: RawPosition[];
  stopDataList?: RawStop[];
  totalDistanceTravelled?: number; // metres
};

const posTime = (p: RawPosition | undefined) =>
  (p ? rsStr(p.fixTime) ?? rsStr(p.deviceTime) : null);

// Local null-coercing helpers (the `num`/`str` consts below aren't initialized
// until module eval reaches them; these are hoisted so route code is order-safe).
function rsNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function rsStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Travelled route + stops for a device over [fromISO, toISO].
 * Speeds are converted knots → km/h; distance metres → km.
 */
export async function millitrackRoute(
  deviceId: string | number,
  fromISO: string,
  toISO: string,
): Promise<ProviderRoute> {
  const params = new URLSearchParams({ from: fromISO, to: toISO, mail: "false" });
  params.append("deviceId", String(deviceId));
  params.set("dc", String(Date.now())); // cache buster

  const res = await authedFetch(`/api/reports/routeWithStops?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Millitrack route failed for device ${deviceId} (${res.status}): ${body.slice(0, 160)}`);
  }
  const data = (await res.json()) as RawRouteWithStops;

  const points = (data.onlyMovingPositionList ?? []).flatMap((p) => {
    const lat = rsNum(p.latitude);
    const lng = rsNum(p.longitude);
    if (lat == null || lng == null) return [];
    return [{
      lat,
      lng,
      speedKmh: Math.round((rsNum(p.speed) ?? 0) * KNOTS_TO_KMH),
      course: rsNum(p.course),
      time: posTime(p),
    }];
  });

  const stops = (data.stopDataList ?? []).flatMap((s) => {
    const sp = s.stopPosition ?? {};
    const lat = rsNum(sp.latitude);
    const lng = rsNum(sp.longitude);
    if (lat == null || lng == null) return [];
    return [{
      lat,
      lng,
      address: rsStr(sp.address),
      arrivedAt: posTime(sp),
      departedAt: posTime(s.startPosition),
      durationMs: rsNum(s.stopDuration) ?? 0,
    }];
  });

  return { points, stops, totalDistanceKm: +(((rsNum(data.totalDistanceTravelled) ?? 0) / 1000).toFixed(1)) };
}

// ── Live fleet state (userDevicesState) ──────────────────────────────────────
// One call returns every device's current position/status plus the status-bucket
// counts. Powers the /live tracking page.

/** Normalized live state for one GPS device. */
export type LiveDeviceState = {
  deviceId: number;
  name: string | null;
  uniqueId: string | null;
  category: string | null; // Traccar device category (truck/motorcycle/pickup…) → marker icon
  status: LiveStatus;
  speedKmh: number;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  ignition: boolean;
  charge: boolean;
  blocked: boolean;
  todayDistanceKm: number;
  course: number | null;
  lastUpdate: string | null; // ISO
};

export type FleetLiveState = {
  counts: Record<LiveStatus, number> & { total: number };
  byDeviceId: Map<number, LiveDeviceState>;
};

type RawBucket = { count?: number; deviceIds?: number[] };
type RawDeviceCumPosition = {
  device?: Record<string, unknown>;
  position?: { attributes?: Record<string, unknown> } & Record<string, unknown>;
};
type RawFleetState = {
  totalDevices?: RawBucket;
  running?: RawBucket;
  idle?: RawBucket;
  stopped?: RawBucket;
  inactive?: RawBucket;
  noData?: RawBucket;
  expired?: RawBucket;
  expiringSoon?: RawBucket;
  deviceCumPositionList?: RawDeviceCumPosition[];
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const bool = (v: unknown): boolean => v === true;

/** Map the per-position `currentStatus` string to our LiveStatus (bucket fallback). */
function statusFromCurrent(raw: unknown): LiveStatus {
  switch (str(raw)?.toUpperCase()) {
    case "RUNNING":
      return "running";
    case "IDLE":
      return "idle";
    default:
      return "stopped";
  }
}

function normalizeFleetState(data: RawFleetState): FleetLiveState {
  // The buckets are authoritative for which status a device is in.
  const statusById = new Map<number, LiveStatus>();
  const assign = (bucket: RawBucket | undefined, status: LiveStatus) => {
    for (const id of bucket?.deviceIds ?? []) statusById.set(id, status);
  };
  assign(data.running, "running");
  assign(data.idle, "idle");
  assign(data.stopped, "stopped");
  assign(data.inactive, "inactive");
  assign(data.noData, "noData");
  assign(data.expired, "expired");
  assign(data.expiringSoon, "expiringSoon");

  const counts: FleetLiveState["counts"] = {
    total: data.totalDevices?.count ?? 0,
    running: data.running?.count ?? 0,
    idle: data.idle?.count ?? 0,
    stopped: data.stopped?.count ?? 0,
    inactive: data.inactive?.count ?? 0,
    noData: data.noData?.count ?? 0,
    expired: data.expired?.count ?? 0,
    expiringSoon: data.expiringSoon?.count ?? 0,
  };

  const byDeviceId = new Map<number, LiveDeviceState>();
  for (const item of data.deviceCumPositionList ?? []) {
    const device = item.device ?? {};
    const id = num(device.id);
    if (id == null) continue;
    const position = item.position ?? {};
    const attr = position.attributes ?? {};

    byDeviceId.set(id, {
      deviceId: id,
      name: str(device.name),
      uniqueId: str(device.uniqueId),
      category: str(device.category),
      status: statusById.get(id) ?? statusFromCurrent(attr.currentStatus),
      speedKmh: Math.round((num(position.speed) ?? 0) * KNOTS_TO_KMH),
      latitude: num(position.latitude),
      longitude: num(position.longitude),
      address: str(position.address) ?? str(device.address),
      ignition: bool(attr.ignition),
      charge: bool(attr.charge),
      blocked: bool(attr.blocked),
      todayDistanceKm: +(((num(attr.todayDistance) ?? 0) / 1000).toFixed(1)),
      course: num(position.course),
      lastUpdate: str(device.lastUpdate),
    });
  }

  return { counts, byDeviceId };
}

async function fetchFleetLiveState(): Promise<FleetLiveState> {
  const userId = await getUserId();
  const params = new URLSearchParams({
    pieChartOnly: "false",
    deviceCountOnly: "false",
    app: APP_ID,
    dc: String(Date.now()), // cache buster
  });
  const res = await authedFetch(`/api/users/${userId}/userDevicesState?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Millitrack live state failed (${res.status}): ${body.slice(0, 160)}`);
  }
  return normalizeFleetState((await res.json()) as RawFleetState);
}

// Short-lived shared cache + single-flight. The feed is account-wide (not
// permission-specific — the /live page filters it per user afterwards), so every
// concurrent viewer and overlapping 30s/focus refresh can share one external fetch
// instead of each hitting Millitrack independently.
const FLEET_STATE_TTL_MS = 10_000;
let fleetStateCache: { at: number; state: FleetLiveState } | null = null;
let fleetStateInFlight: Promise<FleetLiveState> | null = null;

/**
 * Live state for every device on the account (positions + status-bucket counts).
 * Cached for FLEET_STATE_TTL_MS with single-flight de-dup so concurrent callers
 * collapse to a single upstream request. Only successful fetches are cached; on
 * error the in-flight promise is cleared and the next call retries.
 */
export async function getFleetLiveState(): Promise<FleetLiveState> {
  if (fleetStateCache && Date.now() - fleetStateCache.at < FLEET_STATE_TTL_MS) {
    return fleetStateCache.state;
  }
  if (fleetStateInFlight) return fleetStateInFlight;
  fleetStateInFlight = (async () => {
    try {
      const state = await fetchFleetLiveState();
      fleetStateCache = { at: Date.now(), state };
      return state;
    } finally {
      fleetStateInFlight = null;
    }
  })();
  return fleetStateInFlight;
}
