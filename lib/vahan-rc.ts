// Server-side RC lookup via vahandetails.com's get-rc-details API.
//
// Unlike Cars24 (lib/cars24.ts), this endpoint authenticates with a plain
// `x-api-key` header instead of a browser session, so it works from a server
// IP (e.g. Vercel) without Cloudflare challenges or per-session verification
// limits. It returns the full Parivahan RC record; we use only the document
// expiry dates (insurance / fitness / pollution) to refresh the fleet.
//
// Keep this module free of "use server" — it is a plain server-only helper like
// lib/cars24.ts and lib/millitrack.ts.

const API_URL = "https://backend.vahandetails.com/api/get-rc-details";

// `Test_1234` is vahandetails' shared demo key — fine for local/dev, but set a
// real VAHANDETAILS_API_KEY in production: the demo key is rate-limited and may
// be revoked without notice.
const API_KEY = process.env.VAHANDETAILS_API_KEY || "Test_1234";

const TIMEOUT_MS = Number(process.env.VAHANDETAILS_TIMEOUT_MS ?? 15000);

// The RC record under `data`. vahandetails returns both camelCase (rcFitUpto)
// and snake_case (rc_fit_upto) copies of each field; we read camelCase first
// and fall back to snake_case. Only the fields we touch are typed.
export type VahanRcDetail = {
  rcRegnNo?: string | null;
  rcStatus?: string | null;
  rcInsuranceUpto?: string | null;
  rcFitUpto?: string | null;
  rcPuccUpto?: string | null;
  rc_insurance_upto?: string | null;
  rc_fit_upto?: string | null;
  rc_pucc_upto?: string | null;
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

// vahandetails returns dates as ISO datetimes (`2027-06-11T12:00:00.000Z`); we
// keep just the calendar date. Indian d-m-y variants are accepted defensively.
// Returns a clean `YYYY-MM-DD` or null so a bad value never overwrites a real one.
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

/** True when vahandetails actually returned an RC record for this vehicle. */
export function hasVahanData(detail: VahanRcDetail | null): detail is VahanRcDetail {
  return Boolean(
    detail && (detail.rcRegnNo || detail.rcInsuranceUpto || detail.rcFitUpto || detail.rcPuccUpto),
  );
}

/**
 * Extract document expiry dates from a vahandetails RC record. Only insurance,
 * fitness and pollution are read — owner/registration details are intentionally
 * ignored so a refresh never touches the stored owner name. Only valid dates are
 * returned, so the caller never overwrites a real date with garbage.
 */
export function extractRtoDocuments(detail: VahanRcDetail | null): RtoDocuments {
  if (!detail) return {};

  const docs: RtoDocuments = {};
  const insurance = normalizeIsoDate(detail.rcInsuranceUpto ?? detail.rc_insurance_upto);
  const fitness = normalizeIsoDate(detail.rcFitUpto ?? detail.rc_fit_upto);
  const pollution = normalizeIsoDate(detail.rcPuccUpto ?? detail.rc_pucc_upto);
  if (insurance) docs.insurance_expiry = insurance;
  if (fitness) docs.fitness_expiry = fitness;
  if (pollution) docs.pollution_expiry = pollution;
  return docs;
}

async function fetchVahanOnce(reg: string): Promise<VahanRcDetail | null> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/plain, */*",
      "x-api-key": API_KEY,
      origin: "https://vahandetails.com",
      referer: "https://vahandetails.com/",
    },
    body: JSON.stringify({ rc_number: reg }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  const text = await res.text();
  if (res.status === 403) throw new Error("invalid or missing API key (HTTP 403)");
  if (res.status >= 500) throw new Error(`vahandetails server error (HTTP ${res.status})`);

  let json: { status?: boolean; message?: string; data?: VahanRcDetail | null };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response (HTTP ${res.status})`);
  }

  // `status:false` means no usable data. A rate-limit / quota message is a
  // failure the caller should surface; anything else means "no RC record" and
  // is counted as skipped.
  if (!json?.status) {
    const msg = json?.message || "";
    if (/limit|exceed|quota|too many/i.test(msg)) throw new Error(msg);
    return null;
  }
  return json?.data ?? null;
}

/**
 * Fetch the vahandetails RC record for a registration number. Retries once on
 * failure (their origin intermittently times out), then throws so the caller
 * can count it as a failure and move on.
 */
export async function fetchVahanDetail(reg: string): Promise<VahanRcDetail | null> {
  const normalized = normalizeRegistration(reg);
  try {
    return await fetchVahanOnce(normalized);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return fetchVahanOnce(normalized);
  }
}
