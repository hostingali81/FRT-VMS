// Fetch RTO details for every vehicle from Cars24's public service-history API.
//
// Unlike TransportBook/Spinny, this endpoint returns rich data directly (no
// login, no per-account verification limit) when called with the MWEB client
// header. The richest payload is the `full_details` JSON embedded in the
// response. Output is a new CSV; the run is resumable.
//
// Usage:
//   node vehicle-info/scripts/fetch-cars24-info.mjs [input.xlsx|csv] [output.csv]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workflowDir = dirname(scriptDir);
const argv = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const inputPath = argv[0] ?? join(workflowDir, "Vehicles.xlsx");
const outputPath = argv[1] ?? join(workflowDir, "cars24-rto-info.csv");

const API = (reg) =>
  `https://cars-consumer.cars24.team/api/v1/product/service-history?regNumber=${encodeURIComponent(reg)}`;
const HEADERS = {
  "x-client-type": "MWEB",
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

const DELAY_MS = Number(process.env.CARS24_DELAY_MS ?? 400);
const TIMEOUT_MS = Number(process.env.CARS24_TIMEOUT_MS ?? 25000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeRegistration(value) {
  return String(value ?? "").toUpperCase().replace(/\s+/g, "");
}

function readVehicleNumbers(path) {
  if (!existsSync(path)) throw new Error(`Input file not found: ${path}`);
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  return rows
    .map((row) => normalizeRegistration(row["Vehicle Number"] ?? Object.values(row)[0]))
    .filter(Boolean);
}

function doneSet(rows) {
  return new Set(rows.map((r) => normalizeRegistration(r["Vehicle Number"])).filter(Boolean));
}

// Minimal CSV parser so re-reading the output preserves exact strings
// (XLSX would coerce values like ISO dates when reading a CSV back).
function parseCsv(text) {
  const records = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); records.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); records.push(row); }
  return records;
}

function readExisting() {
  if (!existsSync(outputPath)) return { rows: [], done: new Set() };
  const records = parseCsv(readFileSync(outputPath, "utf8")).filter((r) => r.some((c) => c !== ""));
  if (records.length < 2) return { rows: [], done: new Set() };
  const header = records[0];
  const rows = records.slice(1).map((rec) => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = rec[i] ?? ""; });
    return obj;
  });
  return { rows, done: doneSet(rows) };
}

// Flatten nested values into dotted keys (the fallback path; full_details is
// already flat).
function flatten(value, prefix, out) {
  if (value === null || value === undefined) {
    out[prefix] = "";
  } else if (Array.isArray(value)) {
    out[prefix] = value.every((v) => typeof v !== "object" || v === null)
      ? value.join("; ")
      : JSON.stringify(value);
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = String(value);
  }
}

function buildCsv(rows) {
  const keys = ["Vehicle Number"];
  for (const row of rows) for (const k of Object.keys(row)) if (!keys.includes(k)) keys.push(k);
  return XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows, { header: keys }));
}

function saveAll(rows) {
  writeFileSync(outputPath, buildCsv(rows), "utf8");
}

// Build a clean, complete row from the API response. Prefers the rich
// full_details payload; fills any gaps from the top-level detail object.
function rowFromDetail(vehicle, detail) {
  const row = { "Vehicle Number": vehicle };

  let full = null;
  if (detail.full_details) {
    try {
      full = JSON.parse(detail.full_details);
    } catch {
      full = null;
    }
  }
  if (full) {
    for (const [k, v] of Object.entries(full)) row[k] = v === null || v === undefined ? "" : String(v);
  }

  // A few useful top-level fields not always present in full_details.
  const extras = {
    makeDisplayName: detail.makeDisplayName,
    modelDisplayName: detail.modelDisplayName,
    variantDisplayName: detail.bestMatchVariantDisplayName,
    vehicleMmv: detail.vehicleMmv,
  };
  for (const [k, v] of Object.entries(extras)) {
    if (v && !row[k]) row[k] = String(v);
  }

  if (!full) {
    const flat = {};
    flatten({ ...detail, full_details: undefined }, "", flat);
    for (const [k, v] of Object.entries(flat)) if (!(k in row) && v !== undefined) row[k] = v;
  }

  return row;
}

async function fetchVehicle(reg) {
  const res = await fetch(API(reg), { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response (HTTP ${res.status})`);
  }
  return json?.vehicleResponseDto?.detail ?? null;
}

async function main() {
  const vehicles = readVehicleNumbers(inputPath);
  const { rows, done } = readExisting();
  const pending = vehicles.filter((v) => !done.has(v));

  console.log(`Total: ${vehicles.length} | already saved: ${done.size} | to fetch: ${pending.length}`);
  if (pending.length === 0) {
    console.log(`Nothing to do. Output: ${outputPath}`);
    return;
  }

  let saved = 0;
  let noData = 0;
  for (const [i, vehicle] of pending.entries()) {
    try {
      const detail = await fetchVehicle(vehicle);
      if (!detail || (!detail.full_details && !detail.registrationNumber && !detail.rc_model)) {
        noData += 1;
        console.log(`- ${vehicle}: no data (will retry next run)`);
      } else {
        rows.push(rowFromDetail(vehicle, detail));
        saveAll(rows);
        saved += 1;
        const r = rows[rows.length - 1];
        console.log(`+ ${vehicle}: ${r.maker ?? r.makeDisplayName ?? ""} ${r.model ?? ""}`.trim());
      }
    } catch (e) {
      noData += 1;
      console.log(`- ${vehicle}: error -> ${e.message} (will retry next run)`);
    }
    if (DELAY_MS > 0 && i < pending.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nDone. Saved this run: ${saved}. No-data/errors: ${noData}. Total in file: ${rows.length}.`);
  console.log(`Output: ${outputPath}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
