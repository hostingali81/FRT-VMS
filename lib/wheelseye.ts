/**
 * WheelsEye GPS platform client. Server-only — call only from server actions / cron.
 *
 * Auth: POST /shield/admin/v3/login with { userName: <phone>, password } returns
 * data.accessToken (a UUID), sent in the `token` header on later calls. We log in
 * with WHEELSEYE_LOGIN + WHEELSEYE_PASSWORD and cache the token in memory.
 *
 * IMPORTANT — the login must look like the browser (full User-Agent / sec-ch-ua /
 * deviceId-cookie set, see baseHeaders). A "plain" login yields a token that the
 * live `vehicles-dynamic` endpoint silently rejects (HTTP 200 with empty `data`).
 * With browser-like headers the same endpoint returns full telemetry.
 *
 * Live data (getWheelsEyeLiveState): the rich per-vehicle live feed comes from
 *   POST /rest/argus/app/vehicles-dynamic  { vehicleIds: number[] }
 * keyed by the *static* vehicleId (from /rest/argus/app/vehicles/static — NOT the
 * id returned by /vehicle/getAll). The endpoint rejects oversized batches, so ids
 * are sent in chunks of <= DYNAMIC_BATCH. It returns speed, today's km
 * (sanitizedDistance), reverse-geocoded address, ignition, mode and lat/lng — i.e.
 * the same figures the WheelsEye dashboard shows.
 *
 * Matching a VMS vehicle to a WheelsEye one: the vehicle's gps_device_id holds that
 * static vehicleId, and it is the primary key we join on. Registration is only a
 * fallback, because the two drift apart in practice — when a device is moved into
 * another truck, WheelsEye keeps labelling it with the registration it was first
 * installed under until someone renames it there. The results are therefore keyed
 * both ways (byId / byReg); callers should prefer byId.
 *
 * Distance (cron) still comes from the report API (wheelsEyeDistanceByReg).
 */

import { randomUUID } from "node:crypto";
import type { LiveStatus, ProviderRoute } from "@/lib/types";

const BASE = process.env.WHEELSEYE_BASE_URL ?? "https://wheelseye.com";
const WE_APP_VERSION = "18.4.0";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
// vehicles-dynamic returns empty `data` for batches larger than this, so chunk.
const DYNAMIC_BATCH = 10;

let cachedToken: string | null = null;
let cachedDeviceId: string | null = null;

export function isWheelsEyeConfigured() {
  return Boolean(process.env.WHEELSEYE_LOGIN && process.env.WHEELSEYE_PASSWORD);
}

// A stable per-process deviceId, like the web app stores in a cookie.
function deviceId(): string {
  if (!cachedDeviceId) cachedDeviceId = randomUUID();
  return cachedDeviceId;
}

// Browser-like headers. The User-Agent / sec-ch-ua / deviceId cookie are what make
// the issued token acceptable to the live endpoints (see file header).
function baseHeaders(): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json",
    cookie: `deviceId=${deviceId()}`,
    origin: BASE,
    referer: `${BASE}/node/dashboard`,
    "sec-ch-ua": '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    source: "OPERATOR_WEB",
    "user-agent": UA,
    "x-app-version": WE_APP_VERSION,
  };
}

const authHeaders = (token: string) => ({ ...baseHeaders(), token });

async function login(): Promise<string> {
  const userName = process.env.WHEELSEYE_LOGIN;
  const password = process.env.WHEELSEYE_PASSWORD;
  if (!userName || !password) throw new Error("WHEELSEYE_LOGIN / WHEELSEYE_PASSWORD env vars are not set");

  const res = await fetch(`${BASE}/shield/admin/v3/login`, {
    method: "POST",
    headers: { ...baseHeaders(), referer: `${BASE}/` },
    body: JSON.stringify({ userName, password }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`WheelsEye login failed (${res.status}): ${body.slice(0, 160)}`);
  }
  const data = (await res.json().catch(() => null)) as { success?: boolean; data?: { accessToken?: string } } | null;
  if (!data?.success || !data?.data?.accessToken) throw new Error("WheelsEye login succeeded but no accessToken");
  return data.data.accessToken;
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken) return cachedToken;
  cachedToken = await login();
  return cachedToken;
}

/** GET/POST a WheelsEye API path with the cached token; re-logs in once on 401/403. */
async function weRequest(path: string, init?: RequestInit): Promise<unknown> {
  let token = await getToken();
  const doFetch = (t: string) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...authHeaders(t), ...((init?.headers as Record<string, string>) ?? {}) },
      cache: "no-store",
    });

  let res = await doFetch(token);
  if (res.status === 401 || res.status === 403) {
    cachedToken = null;
    token = await getToken(true);
    res = await doFetch(token);
  }
  if (!res.ok) throw new Error(`WheelsEye ${path.split("?")[0]} failed (${res.status})`);
  return res.json();
}

const normReg = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

type WeVehicle = { name: string; value: number };

function parseVehicleList(json: unknown): WeVehicle[] {
  const arr = (Array.isArray(json) ? json : (json as { data?: unknown[] })?.data ?? []) as Array<{ vNo?: string; vId?: number }>;
  return arr.map((v) => ({ name: v.vNo ?? "", value: v.vId ?? 0 })).filter((v) => v.name && v.value);
}

/**
 * Distance (km) per registration over [fromSec, toSec] (Unix seconds).
 * Returns Map keyed by normalized registration (UPPER, no spaces/dashes).
 * One report call covers every vehicle on the WheelsEye account. Used by the cron.
 */
export async function wheelsEyeDistanceByReg(fromSec: number, toSec: number): Promise<Map<string, number>> {
  const vehicles = parseVehicleList(await weRequest("/vehicle/getAll"));

  const body = {
    reportType: "distance",
    filters: [
      { code: "vehicles", options: vehicles.map((v) => ({ name: v.name, value: v.value, isSelected: true })) },
      {
        code: "reportTime",
        options: [{ name: "Date Range", value: "CUSTOM", metadata: { custom: true, dateRange: { from: fromSec, to: toSec } } }],
      },
      { code: "report_type", options: [{ name: "Distance", value: "distance", isSelected: true }] },
    ],
  };

  const json = (await weRequest("/rest/argus/reports/generate/v2", {
    method: "POST",
    body: JSON.stringify(body),
  })) as { success?: boolean; message?: string; data?: { reportContent?: { data?: unknown[][] } } };
  if (!json?.success) throw new Error(`WheelsEye report error: ${json?.message ?? "unknown"}`);

  const rows = json.data?.reportContent?.data ?? [];
  const map = new Map<string, number>();
  for (const r of rows) {
    // [vehicleNo, fromDate, toDate, distanceKM, timeTaken, hasDevice]
    map.set(normReg(String(r[0])), parseFloat(String(r[3])) || 0);
  }
  return map;
}

// ── Route history (replay) ───────────────────────────────────────────────────
// The travelled path comes from /vehicle/getPathDetail as an encoded
// `followedPolyLine`; the parked segments come from /vehicle/getItinerary
// (STOPPAGE itineraries). Both are keyed by the static vehicleId.

const MAX_ROUTE_POINTS = 600;

type DecodedPoint = { latitude: number; longitude: number; time: number; speed: number };

/**
 * WheelsEye's followedPolyLine encodes a quadruple per point: latitude, longitude,
 * time and speed — each a delta-encoded varint accumulated from the previous point.
 * lat/lng/speed use the standard polyline varint; time uses a BigInt variant. This
 * mirrors WheelsEye's own dashboard decoder exactly (speed comes out as km/h, time
 * as Unix seconds).
 */
function decodeWheelsEyePolyline(encoded: unknown): DecodedPoint[] {
  if (typeof encoded !== "string" || !encoded) return [];
  const points: DecodedPoint[] = [];
  const length = encoded.length;
  let index = 0;
  let lat = 0;
  let lng = 0;
  let time = BigInt(0);
  let speed = 0;

  while (index < length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    let timeShift = BigInt(0);
    let timeAcc = BigInt(1);
    let timeByte: bigint;
    do {
      timeByte = BigInt(encoded.charCodeAt(index++) - 64);
      timeAcc += timeByte << timeShift;
      timeShift += BigInt(5);
    } while (timeByte >= BigInt(31));
    time += timeAcc & BigInt(1) ? ~(timeAcc >> BigInt(1)) : timeAcc >> BigInt(1);

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    speed += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5, time: Number(time), speed: Math.max(0, speed) });
  }
  return points;
}

/** Downsample a dense trail so the replay isn't choked with thousands of points. */
function thinRoutePoints<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const out: T[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** Itinerary distance (km): top-level total, then running total, then sum of driving legs. */
function itineraryDistanceKm(itin: Record<string, unknown>, segments: Array<Record<string, unknown>>): number {
  const top = fin(itin.totalDistance);
  if (top && top > 0) return top;
  const running = fin(itin.totalRunningDistanceKM);
  if (running && running > 0) return running;
  const drivingMeters = segments
    .filter((s) => String(s.mode ?? "").toUpperCase() === "DRIVING")
    .reduce((sum, s) => sum + (fin(s.totalDistance) ?? 0), 0);
  return drivingMeters / 1000;
}

/** Resolve the static vehicleId for a registration (the key getPathDetail expects). */
export async function wheelsEyeVehicleIdForReg(reg: string): Promise<number | null> {
  const idToReg = await fetchStaticFleet();
  const target = normReg(reg);
  for (const [id, r] of Array.from(idToReg)) if (normReg(r) === target) return id;
  return null;
}

/**
 * A vehicle's stored gps_device_id as a WheelsEye vehicleId, or null if it isn't a
 * plain number. This is the id every WheelsEye endpoint here is keyed by.
 */
export function parseWheelsEyeVehicleId(deviceId: string | number | null | undefined): number | null {
  const raw = String(deviceId ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * The key a vehicle's row carries in wheelsEyeDistanceByReg: the registration
 * WheelsEye itself holds for the mapped vehicleId, falling back to ours. The two
 * differ once a device is moved to another vehicle and nobody renamed it there.
 */
export async function wheelsEyeDistanceKey(
  deviceId: string | number | null | undefined,
  registration: string,
): Promise<string> {
  const id = parseWheelsEyeVehicleId(deviceId);
  const weReg = id == null ? null : (await fetchStaticFleet()).get(id);
  return normReg(weReg ?? registration);
}

/** Travelled route + stops for a WheelsEye vehicle over [fromSec, toSec] (Unix seconds). */
export async function wheelsEyeRoute(vehicleId: number, fromSec: number, toSec: number): Promise<ProviderRoute> {
  const [pathJson, itinJson] = await Promise.all([
    weRequest(`/vehicle/getPathDetail?vehicleId=${vehicleId}&fromTime=${fromSec}&toTime=${toSec}`),
    // The itinerary (stops) is best-effort: a failure there shouldn't drop the path.
    weRequest(`/vehicle/getItinerary?vehicleId=${vehicleId}&fromTime=${fromSec}&toTime=${toSec}&showGeofenceData=true`).catch(
      () => null,
    ),
  ]);

  const pathData = (pathJson as { data?: { followedPolyLine?: string } })?.data ?? {};
  const decoded = thinRoutePoints(decodeWheelsEyePolyline(pathData.followedPolyLine), MAX_ROUTE_POINTS);
  const points = decoded.map((p) => ({
    lat: p.latitude,
    lng: p.longitude,
    speedKmh: Math.max(0, Math.round(p.speed)),
    course: null, // bearing is derived client-side from consecutive points
    time: Number.isFinite(p.time) ? new Date(p.time * 1000).toISOString() : null,
  }));

  const itin = (itinJson as { data?: Record<string, unknown> })?.data ?? {};
  const segments = (Array.isArray(itin.itineraries) ? itin.itineraries : []) as Array<Record<string, unknown>>;
  const stops = segments
    .filter((s) => String(s.mode ?? "").toUpperCase() === "STOPPAGE")
    .flatMap((s) => {
      const lat = fin(s.fromLat);
      const lng = fin(s.fromLng);
      if (lat == null || lng == null) return [];
      const fromT = fin(s.fromTime);
      const toT = fin(s.toTime);
      const loc = typeof s.fromLocName === "string" && s.fromLocName.trim() ? s.fromLocName.trim() : null;
      return [{
        lat,
        lng,
        address: loc,
        arrivedAt: fromT != null ? new Date(fromT * 1000).toISOString() : null,
        departedAt: toT != null ? new Date(toT * 1000).toISOString() : null,
        durationMs: (fin(s.totalTime) ?? 0) * 1000,
      }];
    });

  // WheelsEye returns itineraries newest-first, but the replay path (points) is
  // chronological and the map numbers stops in array order. Sort stops by arrival
  // so stop #1 is the first one the playback reaches — otherwise the numbering runs
  // backwards against the play (Millitrack already returns stops chronologically).
  stops.sort((a, b) => (a.arrivedAt ? Date.parse(a.arrivedAt) : 0) - (b.arrivedAt ? Date.parse(b.arrivedAt) : 0));

  return { points, stops, totalDistanceKm: +itineraryDistanceKm(itin, segments).toFixed(1) };
}

// ── Live status/location/telemetry (vehicles-dynamic) ────────────────────────

/** Normalized WheelsEye live record, keyed by normalized registration. */
export type WheelsEyeLiveState = {
  vehicleId: number;
  registration: string;
  status: LiveStatus;
  speedKmh: number | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  ignition: boolean | null;
  blocked: boolean | null; // parking lock / immobiliser
  course: number | null;
  todayDistanceKm: number | null;
  lastUpdate: string | null; // ISO
};

type DynamicVehicle = {
  speed?: number;
  sanitizedDistance?: number;
  latitude?: number;
  longitude?: number;
  angle?: number;
  mode?: string;
  ignitionState?: string;
  addr?: string;
  time?: number; // unix seconds
  parkLockActive?: boolean;
};

/** Map WheelsEye's mode + ignition to our LiveStatus. */
function deriveStatus(mode: string | undefined, ignState: string | undefined): LiveStatus {
  const m = String(mode ?? "").toUpperCase();
  if (m === "DRIVING") return "running";
  if (m === "NO_INFO") return "noData";
  if (String(ignState ?? "").toUpperCase() === "ON") return "idle";
  return "stopped";
}

const fin = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// The static fleet (vehicleId ↔ registration) rarely changes; cache it for a while.
// These vehicleIds are the keys vehicles-dynamic expects (≠ /vehicle/getAll's vId).
const STATIC_TTL_MS = 60 * 60 * 1000;
let staticCache: { at: number; idToReg: Map<number, string> } | null = null;

// Per-vehicle dynamic telemetry cache, shared across all callers/scopes and keyed
// by vehicleId. A vehicle fetched for one user (or refresh tick) is reused for any
// other within the TTL, so concurrent viewers and the 30s/focus refreshes collapse
// into far fewer upstream calls. Permission scoping happens in the caller, so it is
// safe to share raw telemetry here.
const DYNAMIC_TTL_MS = 10_000;
type DynamicEntry = { at: number; data: DynamicVehicle };
const dynamicCache = new Map<number, DynamicEntry>();
// Last time vehicles-dynamic returned ≥1 record. Lets us tell a silently-rejected
// token (HTTP 200 + empty data) apart from a small batch that is just genuinely
// offline, so we only force a re-login when there's no recent proof the token works.
let dynamicOkAt = 0;
const DYNAMIC_TRUST_MS = 60_000;

async function fetchStaticFleet(): Promise<Map<number, string>> {
  if (staticCache && Date.now() - staticCache.at < STATIC_TTL_MS) return staticCache.idToReg;

  const idToReg = new Map<number, string>();
  for (let page = 0; page < 50; page++) {
    const json = (await weRequest(`/rest/argus/app/vehicles/static?pageNo=${page}&size=50`)) as {
      data?: { list?: Array<{ vehicleId?: number; vehicleNumber?: string }>; totalPages?: number };
    };
    const list = json?.data?.list ?? [];
    for (const v of list) {
      const id = Number(v?.vehicleId);
      const reg = String(v?.vehicleNumber ?? "").trim();
      if (id > 0 && reg) idToReg.set(id, reg);
    }
    if (page >= Number(json?.data?.totalPages ?? 1) - 1) break;
  }
  staticCache = { at: Date.now(), idToReg };
  return idToReg;
}

// Upstream rejects oversized batches, so we keep DYNAMIC_BATCH chunks but run a few
// in parallel instead of strictly one-after-another — the chunk count, not latency,
// then drives wall-clock time. Bounded so we don't hammer the endpoint at once.
const DYNAMIC_CONCURRENCY = 5;

/** Fetch dynamic telemetry for the given ids, in parallel chunks, keyed by vehicleId. */
async function fetchDynamic(ids: number[]): Promise<Map<number, DynamicVehicle>> {
  const out = new Map<number, DynamicVehicle>();
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += DYNAMIC_BATCH) chunks.push(ids.slice(i, i + DYNAMIC_BATCH));

  let cursor = 0;
  const worker = async () => {
    while (cursor < chunks.length) {
      const chunk = chunks[cursor++];
      const json = (await weRequest("/rest/argus/app/vehicles-dynamic", {
        method: "POST",
        body: JSON.stringify({ vehicleIds: chunk }),
      })) as { data?: Record<string, DynamicVehicle> };
      const data = json?.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        for (const [vid, d] of Object.entries(data)) out.set(Number(vid), d);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(DYNAMIC_CONCURRENCY, chunks.length) }, worker));
  return out;
}

/** A VMS vehicle to look up: its mapped WheelsEye vehicleId and/or its registration. */
export type WheelsEyeTarget = { deviceId?: string | number | null; registration?: string | null };

/** Live telemetry indexed both ways, so callers can join by id first (see file header). */
export type WheelsEyeLiveFeed = {
  byId: Map<number, WheelsEyeLiveState>;
  byReg: Map<string, WheelsEyeLiveState>; // key: normalized registration (UPPER, no spaces/dashes)
};

const emptyFeed = (): WheelsEyeLiveFeed => ({ byId: new Map(), byReg: new Map() });

/**
 * Live telemetry for WheelsEye vehicles: speed, today's km, address, ignition and
 * position — the same figures the WheelsEye dashboard shows. Vehicles with no live
 * telemetry are omitted.
 *
 * Pass `targets` to fetch only the vehicles the caller can actually see (the /live
 * page passes its permission-filtered set): we then hit `vehicles-dynamic` for just
 * those ids instead of the whole account. A target contributes its vehicleId and its
 * registration, so a vehicle still resolves through whichever of the two matches.
 * Omit it to cover every vehicle on the account. Telemetry is served from a short
 * per-id cache, so only stale/missing ids are fetched.
 */
export async function getWheelsEyeLiveState(
  targets?: Iterable<WheelsEyeTarget> | null,
): Promise<WheelsEyeLiveFeed> {
  const idToReg = await fetchStaticFleet();
  if (!idToReg.size) return emptyFeed();

  // Resolve which ids we need: the caller's vehicles, or the whole account.
  let neededIds: number[];
  if (targets) {
    const wantIds = new Set<number>();
    const wantRegs = new Set<string>();
    for (const t of Array.from(targets)) {
      const id = parseWheelsEyeVehicleId(t.deviceId);
      if (id != null) wantIds.add(id);
      if (t.registration) wantRegs.add(normReg(t.registration));
    }
    neededIds = [];
    for (const [id, reg] of Array.from(idToReg)) {
      if (wantIds.has(id) || wantRegs.has(normReg(reg))) neededIds.push(id);
    }
  } else {
    neededIds = Array.from(idToReg.keys());
  }
  if (!neededIds.length) return emptyFeed();

  // Only fetch ids whose cached telemetry is missing or past its TTL.
  const now = Date.now();
  const stale = neededIds.filter((id) => {
    const e = dynamicCache.get(id);
    return !e || now - e.at >= DYNAMIC_TTL_MS;
  });

  if (stale.length) {
    let fetched = await fetchDynamic(stale);
    // An empty result usually means the token was silently rejected (HTTP 200 +
    // empty data, not a 401) — but a small scoped batch can also just be offline.
    // Only force a re-login when there's no recent proof the token works.
    if (fetched.size === 0 && Date.now() - dynamicOkAt >= DYNAMIC_TRUST_MS) {
      cachedToken = null;
      staticCache = null;
      await getToken(true);
      fetched = await fetchDynamic(stale);
    }
    if (fetched.size > 0) dynamicOkAt = Date.now();
    const at = Date.now();
    for (const [id, d] of Array.from(fetched)) dynamicCache.set(id, { at, data: d });
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const feed = emptyFeed();
  for (const id of neededIds) {
    const reg = idToReg.get(id);
    const entry = dynamicCache.get(id);
    if (!reg || !entry) continue;
    const d = entry.data;
    const speed = fin(d.speed);
    const km = fin(d.sanitizedDistance);
    const t = fin(d.time);
    const state: WheelsEyeLiveState = {
      vehicleId: id,
      registration: reg,
      status: deriveStatus(d.mode, d.ignitionState),
      speedKmh: speed == null ? null : Math.round(speed),
      latitude: fin(d.latitude),
      longitude: fin(d.longitude),
      address: typeof d.addr === "string" && d.addr.trim() ? d.addr.trim() : null,
      ignition: d.ignitionState ? String(d.ignitionState).toUpperCase() === "ON" : null,
      blocked: typeof d.parkLockActive === "boolean" ? d.parkLockActive : null,
      course: fin(d.angle),
      todayDistanceKm: km == null ? null : round1(km),
      lastUpdate: t == null ? null : new Date(t * 1000).toISOString(),
    };
    feed.byId.set(id, state);
    feed.byReg.set(normReg(reg), state);
  }
  return feed;
}
