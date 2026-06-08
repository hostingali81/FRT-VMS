/**
 * WheelsEye GPS platform client. Server-only — call only from server actions / cron.
 *
 * Auth: POST /shield/admin/v3/login with { userName: <phone>, password } returns
 * data.accessToken (a UUID). That token goes in the `token` header on subsequent
 * calls. No env token needed — we log in with WHEELSEYE_LOGIN + WHEELSEYE_PASSWORD
 * and cache the token in memory (re-login on 401/403, same as Millitrack).
 *
 * Distance comes from the report API in one call for all vehicles (KM already in km).
 */

const BASE = process.env.WHEELSEYE_BASE_URL ?? "https://wheelseye.com";

let cachedToken: string | null = null;

export function isWheelsEyeConfigured() {
  return Boolean(process.env.WHEELSEYE_LOGIN && process.env.WHEELSEYE_PASSWORD);
}

async function login(): Promise<string> {
  const userName = process.env.WHEELSEYE_LOGIN;
  const password = process.env.WHEELSEYE_PASSWORD;
  if (!userName || !password) throw new Error("WHEELSEYE_LOGIN / WHEELSEYE_PASSWORD env vars are not set");

  const res = await fetch(`${BASE}/shield/admin/v3/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
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

const authHeaders = (token: string) => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  token,
  source: "OPERATOR_WEB",
  "x-app-version": "18.4.0",
});

const normReg = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

type WeVehicle = { name: string; value: number };

async function getVehicleList(token: string): Promise<WeVehicle[]> {
  const res = await fetch(`${BASE}/vehicle/getAll`, { headers: authHeaders(token) });
  if (res.status === 401 || res.status === 403) {
    cachedToken = null;
    const fresh = await getToken(true);
    return getVehicleListWith(fresh);
  }
  if (!res.ok) throw new Error(`WheelsEye getAll failed (${res.status})`);
  return parseVehicleList(await res.json());
}

async function getVehicleListWith(token: string): Promise<WeVehicle[]> {
  const res = await fetch(`${BASE}/vehicle/getAll`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`WheelsEye getAll failed (${res.status})`);
  return parseVehicleList(await res.json());
}

function parseVehicleList(json: unknown): WeVehicle[] {
  const arr = (Array.isArray(json) ? json : (json as { data?: unknown[] })?.data ?? []) as Array<{ vNo?: string; vId?: number }>;
  return arr.map((v) => ({ name: v.vNo ?? "", value: v.vId ?? 0 })).filter((v) => v.name && v.value);
}

/**
 * Distance (km) per registration over [fromSec, toSec] (Unix seconds).
 * Returns Map keyed by normalized registration (UPPER, no spaces/dashes).
 * One report call covers every vehicle on the WheelsEye account.
 */
export async function wheelsEyeDistanceByReg(fromSec: number, toSec: number): Promise<Map<string, number>> {
  let token = await getToken();
  const vehicles = await getVehicleList(token);

  const buildBody = () => ({
    reportType: "distance",
    filters: [
      { code: "vehicles", options: vehicles.map((v) => ({ name: v.name, value: v.value, isSelected: true })) },
      {
        code: "reportTime",
        options: [{ name: "Date Range", value: "CUSTOM", metadata: { custom: true, dateRange: { from: fromSec, to: toSec } } }],
      },
      { code: "report_type", options: [{ name: "Distance", value: "distance", isSelected: true }] },
    ],
  });

  const doFetch = (t: string) =>
    fetch(`${BASE}/rest/argus/reports/generate/v2`, { method: "POST", headers: authHeaders(t), body: JSON.stringify(buildBody()) });

  let res = await doFetch(token);
  if (res.status === 401 || res.status === 403) {
    cachedToken = null;
    token = await getToken(true);
    res = await doFetch(token);
  }
  if (!res.ok) throw new Error(`WheelsEye report failed (${res.status})`);

  const json = (await res.json()) as { success?: boolean; message?: string; data?: { reportContent?: { data?: unknown[][] } } };
  if (!json?.success) throw new Error(`WheelsEye report error: ${json?.message ?? "unknown"}`);

  const rows = json.data?.reportContent?.data ?? [];
  const map = new Map<string, number>();
  for (const r of rows) {
    // [vehicleNo, fromDate, toDate, distanceKM, timeTaken, hasDevice]
    map.set(normReg(String(r[0])), parseFloat(String(r[3])) || 0);
  }
  return map;
}
