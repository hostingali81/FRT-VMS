// Refresh vehicle document expiry dates (insurance / fitness / pollution) from
// Cars24's RTO API for the whole fleet, writing directly to Supabase.
//
// This is the local fallback for the Alerts page's "Refresh from RTO" button:
// Cloudflare blocks Cars24 calls from Vercel's datacenter IPs (HTTP 403), but a
// home/office connection is not blocked. Mirrors the logic and counters of
// lib/actions/cars24-actions.ts.
//
// Usage:
//   npm run rto:refresh           # fetch + update Supabase
//   npm run rto:refresh -- --dry  # fetch + show what would change, write nothing
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run via npm script so .env.local loads).");
  process.exit(1);
}

const API = (reg) =>
  `https://cars-consumer.cars24.team/api/v1/product/service-history?regNumber=${encodeURIComponent(reg)}`;
const HEADERS = {
  "x-client-type": "MWEB",
  accept: "application/json, text/plain, */*",
  "accept-language": "en-IN,en;q=0.9,hi;q=0.8",
  origin: "https://www.cars24.com",
  referer: "https://www.cars24.com/",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
};
const CONCURRENCY = 4;
const TIMEOUT_MS = 15000;

function isRealDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function normalizeIsoDate(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return isRealDate(+m[1], +m[2], +m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : null;
  m = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(s);
  if (m) return isRealDate(+m[3], +m[2], +m[1]) ? `${m[3]}-${m[2]}-${m[1]}` : null;
  return null;
}

async function fetchDocs(reg) {
  const res = await fetch(API(reg.toUpperCase().replace(/\s+/g, "")), {
    headers: HEADERS,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (res.status >= 500) throw new Error(`Cars24 server error (HTTP ${res.status})`);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response (HTTP ${res.status})`);
  }
  const detail = json?.vehicleResponseDto?.detail;
  if (!detail || !(detail.full_details || detail.registrationNumber || detail.rc_model)) return null;

  let src = detail;
  if (detail.full_details) {
    try {
      src = JSON.parse(detail.full_details);
    } catch {
      src = detail;
    }
  }
  return {
    insurance_expiry: normalizeIsoDate(src.insuranceUpTo),
    fitness_expiry: normalizeIsoDate(src.fitnessUpTo),
    pollution_expiry: normalizeIsoDate(src.pucUpTo),
  };
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: vehicles, error } = await supabase
  .from("vehicles")
  .select("id,registration_no,insurance_expiry,fitness_expiry,pollution_expiry,status")
  .neq("status", "removed")
  .order("registration_no");

if (error) {
  console.error("Failed to load vehicles:", error.message);
  process.exit(1);
}

console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Refreshing RTO documents for ${vehicles.length} vehicles...\n`);

let updated = 0;
let unchanged = 0;
let noData = 0;
let failed = 0;

for (let i = 0; i < vehicles.length; i += CONCURRENCY) {
  const batch = vehicles.slice(i, i + CONCURRENCY);
  await Promise.all(
    batch.map(async (vehicle) => {
      try {
        const docs = await fetchDocs(vehicle.registration_no);
        if (!docs) {
          noData += 1;
          console.log(`  ${vehicle.registration_no}: no RTO record`);
          return;
        }

        const update = {};
        for (const field of ["insurance_expiry", "fitness_expiry", "pollution_expiry"]) {
          if (docs[field] && docs[field] !== vehicle[field]) update[field] = docs[field];
        }

        if (Object.keys(update).length === 0) {
          unchanged += 1;
          console.log(`  ${vehicle.registration_no}: already up to date`);
          return;
        }

        const changes = Object.entries(update)
          .map(([k, v]) => `${k.replace("_expiry", "")} ${vehicle[k] ?? "—"} -> ${v}`)
          .join(", ");

        if (!DRY_RUN) {
          const { error: upErr } = await supabase.from("vehicles").update(update).eq("id", vehicle.id);
          if (upErr) throw new Error(upErr.message);
        }
        updated += 1;
        console.log(`  ${vehicle.registration_no}: ${DRY_RUN ? "WOULD UPDATE" : "UPDATED"} (${changes})`);
      } catch (e) {
        failed += 1;
        console.log(`  ${vehicle.registration_no}: FAILED (${e.message})`);
      }
    }),
  );
}

console.log(
  `\n${DRY_RUN ? "[DRY RUN] " : ""}Done — ${updated} of ${vehicles.length} ${DRY_RUN ? "would be " : ""}updated` +
    ` (${unchanged} already up to date, ${noData} no RTO record, ${failed} failed).`,
);
