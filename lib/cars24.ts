// Server-side port of vehicle-info/scripts/fetch-cars24-info.mjs.
//
// Pulls RTO / registration details for a vehicle from Cars24's public
// `service-history` API (no login, no per-account verification limit) when
// called with the MWEB client header. The richest payload is the
// `full_details` JSON embedded in the response.
//
// Used by lib/actions/cars24-actions.ts to refresh document expiry dates
// (insurance / fitness / pollution) for the fleet on demand. Keep this module
// free of "use server"; it is a plain server-only helper, like lib/millitrack.ts.

const API = (reg: string) =>
  `https://cars-consumer.cars24.team/api/v1/product/service-history?regNumber=${encodeURIComponent(reg)}`;

const HEADERS = {
  "x-client-type": "MWEB",
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

const TIMEOUT_MS = Number(process.env.CARS24_TIMEOUT_MS ?? 12000);

export type Cars24Detail = {
  full_details?: string | null;
  registrationNumber?: string | null;
  rc_model?: string | null;
  [key: string]: unknown;
};

/** Vehicle document expiry dates as ISO `YYYY-MM-DD`, omitted when unavailable. */
export type RtoDocuments = {
  insurance_expiry?: string;
  fitness_expiry?: string;
  pollution_expiry?: string;
};

export function normalizeRegistration(value: string | null | undefined) {
  return String(value ?? "").toUpperCase().replace(/\s+/g, "");
}

function isRealDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

// Cars24 returns these dates as ISO (`2026-11-02`), but accept the common
// Indian d-m-y variants defensively. Returns a clean `YYYY-MM-DD` or null.
function normalizeIsoDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;

  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const [, y, mo, d] = m;
    return isRealDate(+y, +mo, +d) ? `${y}-${mo}-${d}` : null;
  }

  m = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(s);
  if (m) {
    const [, d, mo, y] = m;
    return isRealDate(+y, +mo, +d) ? `${y}-${mo}-${d}` : null;
  }

  return null;
}

/** True when Cars24 actually has a record for this vehicle (mirrors the script). */
export function hasCars24Data(detail: Cars24Detail | null): detail is Cars24Detail {
  return Boolean(detail && (detail.full_details || detail.registrationNumber || detail.rc_model));
}

/**
 * Extract the document expiry dates from a Cars24 detail object. Prefers the
 * rich `full_details` payload, falling back to top-level fields. Only valid
 * dates are returned, so the caller never overwrites a real date with garbage.
 */
export function extractRtoDocuments(detail: Cars24Detail | null): RtoDocuments {
  if (!detail) return {};

  let full: Record<string, unknown> | null = null;
  if (detail.full_details) {
    try {
      full = JSON.parse(detail.full_details);
    } catch {
      full = null;
    }
  }
  const src: Record<string, unknown> = full ?? (detail as Record<string, unknown>);

  const docs: RtoDocuments = {};
  const insurance = normalizeIsoDate(src.insuranceUpTo);
  const fitness = normalizeIsoDate(src.fitnessUpTo);
  const pollution = normalizeIsoDate(src.pucUpTo);
  if (insurance) docs.insurance_expiry = insurance;
  if (fitness) docs.fitness_expiry = fitness;
  if (pollution) docs.pollution_expiry = pollution;
  return docs;
}

/**
 * Fetch the Cars24 detail object for a registration number. Throws on a
 * non-JSON response or network/timeout error so the caller can count it as a
 * failure and move on.
 */
export async function fetchCars24Detail(reg: string): Promise<Cars24Detail | null> {
  const res = await fetch(API(normalizeRegistration(reg)), {
    headers: HEADERS,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await res.text();
  let json: { vehicleResponseDto?: { detail?: Cars24Detail | null } };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response (HTTP ${res.status})`);
  }
  return json?.vehicleResponseDto?.detail ?? null;
}
