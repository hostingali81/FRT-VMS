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
 *   MT_BASE_URL (optional)                    — defaults to http://track4.millitrack.com
 *
 * NOTE: track4 is HTTP (no SSL). The login `username` is the account username
 * (e.g. "imperial.barabanki"), which may differ from the email used by the old
 * web dashboard (mvts4.millitrack.com).
 */

const BASE = process.env.MT_BASE_URL ?? "http://track4.millitrack.com";
const APP_ID = "in.vehiclestep.vehiclesteppro.gpstracker";

/** In-memory JWT cache. Persists across requests within a warm server instance. */
let cachedToken: string | null = null;

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

  const data = (await res.json().catch(() => null)) as { token?: string } | null;
  if (!data?.token) throw new Error("Millitrack login succeeded but no token in response");
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
