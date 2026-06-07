/**
 * Millitrack (Traccar) GPS platform client. Server-only — call only from server actions.
 * https://mvts4.millitrack.com is a Traccar instance — https://www.traccar.org/api-reference/
 *
 * Required env vars:
 *   MT_EMAIL, MT_PASSWORD   — Millitrack login
 *   MT_BASE_URL (optional)  — defaults to https://mvts4.millitrack.com
 *
 * JSESSIONID expires, so we log in fresh on each sync (never hardcode the cookie).
 */

const BASE = process.env.MT_BASE_URL ?? "https://mvts4.millitrack.com";

export function isMillitrackConfigured() {
  return Boolean(process.env.MT_EMAIL && process.env.MT_PASSWORD);
}

export type SummaryRow = {
  deviceId: number;
  deviceName?: string;
  distance: number; // meters
  averageSpeed?: number;
  maxSpeed?: number;
  spentFuel?: number;
  engineHours?: number;
  startOdometer?: number;
  endOdometer?: number;
  startTime?: string;
  endTime?: string;
};

/** Log in and return the "JSESSIONID=..." cookie string. */
export async function millitrackLogin(): Promise<string> {
  const email = process.env.MT_EMAIL;
  const password = process.env.MT_PASSWORD;
  if (!email || !password) throw new Error("MT_EMAIL / MT_PASSWORD env vars are not set");

  const res = await fetch(`${BASE}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Millitrack login failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const setCookie = res.headers.get("set-cookie") ?? "";
  const jsession = setCookie.split(";")[0];
  if (!jsession.toUpperCase().startsWith("JSESSIONID")) {
    throw new Error("Millitrack did not return a session cookie");
  }
  return jsession;
}

/**
 * Distance summary for a single device over a date range.
 * Pass daily=true to get one row per day (used to slice distance per fuel segment).
 */
export async function millitrackSummary(
  cookie: string,
  deviceId: string | number,
  fromISO: string,
  toISO: string,
  daily = false,
): Promise<SummaryRow[]> {
  const params = new URLSearchParams({ from: fromISO, to: toISO });
  params.append("deviceId", String(deviceId));
  if (daily) params.append("daily", "true");

  const res = await fetch(`${BASE}/api/reports/summary?${params.toString()}`, {
    headers: { Accept: "application/json", Cookie: cookie },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Millitrack summary failed for device ${deviceId} (${res.status}): ${body.slice(0, 160)}`);
  }
  return (await res.json()) as SummaryRow[];
}
