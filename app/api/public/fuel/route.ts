import { NextResponse } from "next/server";
import { getAllFuelLogs, getAllGpsDistance, getGpsSyncTimes, getVehicles } from "@/lib/data";
import { syncFuelSegmentDistances, syncMonthlyGpsDistance } from "@/lib/gps-distance";
import { computeMileageByFuel, mileageUnavailableReason, type FuelMileage } from "@/lib/mileage";
import { VEHICLE_STATUSES, type FleetVehicle, type FuelLogEntry, type VehicleStatus } from "@/lib/types";
import { currentYearMonth, isValidYearMonth, monthLabel } from "@/lib/utils/month";

// PUBLIC, unauthenticated, read-only endpoint — the Fuel Dashboard as JSON.
// Whitelisted in middleware.ts (publicPaths "/api/public") so it bypasses the
// login gate. Full reference: /api-docs (rendered from docs/public-api.md).
//
//   GET /api/public/fuel                            → current month, active fleet
//   GET /api/public/fuel?month=2026-07              → one month
//   GET /api/public/fuel?from=2026-06&to=2026-08    → a month range
//   GET /api/public/fuel?month=all                  → whole history
//   GET /api/public/fuel?reg=UP41CT6929&include=logs,months
//
// Every figure comes out of the same lib/mileage.ts tankful maths the Fuel
// Dashboard uses, so the API and the screen can't drift apart.
//
// NOTE: intentionally open. It exposes registration / FRT / deployment / vendor /
// GPS device id and the fuel figures — nothing else. Document expiry dates, the RC
// copy link and owner/vendor mobile numbers are deliberately left out: this is a
// fuel + mileage feed, not a vehicle-document feed.
export const dynamic = "force-dynamic";
// The GPS refresh below makes one provider call per tracked vehicle, exactly like
// the dashboard's "Sync GPS Data" button, so give it the same headroom.
export const maxDuration = 60;

const CORS = {
  // Open API → allow cross-origin reads from any site/app.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

/** Longest range we expand into a month list — guards a typo like from=1900-01. */
const MAX_MONTHS = 240;

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** Case/space/punctuation-insensitive key for matching input against stored text. */
const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const lastDayOf = (yearMonth: string) => {
  const [year, month] = yearMonth.split("-").map(Number);
  return `${yearMonth}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
};

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const [toYear, toMonth] = to.split("-").map(Number);
  let [year, month] = from.split("-").map(Number);
  while ((year < toYear || (year === toYear && month <= toMonth)) && out.length <= MAX_MONTHS) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

type Period = {
  allTime: boolean;
  /** null for all-time — every stored month counts. */
  months: string[] | null;
  fromDate: string;
  toDate: string;
  label: string;
};

/** `month=` / `from=`+`to=` / `month=all` → one resolved reporting window. */
function resolvePeriod(params: URLSearchParams): Period | { error: string; hint: string } {
  const month = (params.get("month") ?? params.get("m") ?? "").trim();
  const from = (params.get("from") ?? "").trim();
  const to = (params.get("to") ?? "").trim();

  if (month.toLowerCase() === "all" || from.toLowerCase() === "all") {
    return { allTime: true, months: null, fromDate: "0000-01-01", toDate: "9999-12-31", label: "All time" };
  }

  if (from || to) {
    const start = from || to;
    const end = to || from;
    if (!isValidYearMonth(start) || !isValidYearMonth(end)) {
      return {
        error: `Invalid month range "${from || "…"}" → "${to || "…"}".`,
        hint: "Use from=YYYY-MM&to=YYYY-MM, e.g. from=2026-06&to=2026-08.",
      };
    }
    if (start > end) {
      return { error: `Range start ${start} is after range end ${end}.`, hint: "Swap from= and to=." };
    }
    const months = monthsBetween(start, end);
    if (months.length > MAX_MONTHS) {
      return { error: `Range covers more than ${MAX_MONTHS} months.`, hint: "Narrow the range, or use month=all." };
    }
    return {
      allTime: false,
      months,
      fromDate: `${start}-01`,
      toDate: lastDayOf(end),
      label: start === end ? monthLabel(start) : `${monthLabel(start)} – ${monthLabel(end)}`,
    };
  }

  if (month && !isValidYearMonth(month)) {
    return { error: `Invalid month "${month}".`, hint: "Use month=YYYY-MM (e.g. month=2026-08), or month=all." };
  }

  const target = month || currentYearMonth();
  return {
    allTime: false,
    months: [target],
    fromDate: `${target}-01`,
    toDate: lastDayOf(target),
    label: monthLabel(target),
  };
}

/** One fuel type's tankful window, flattened for JSON. */
function serialiseMileage(items: FuelMileage[]) {
  return items.map((item) => ({
    fuel_type: item.fuelType,
    kmpl: item.breakdown.kmpl,
    distance_km: item.breakdown.distanceKm,
    litres: item.breakdown.litres,
    fills: item.breakdown.fills,
    from_date: item.breakdown.fromDate,
    to_date: item.breakdown.toDate,
  }));
}

/**
 * Headline mileage for a window. A bi-fuel vehicle gets one entry per fuel type in
 * `by_fuel_type`; `kmpl` reports the dominant fuel (most litres burned) — the same
 * number the dashboard renders at full size.
 */
function buildMileage(logs: FuelLogEntry[]) {
  const byFuel = computeMileageByFuel(logs);
  const dominant = byFuel.reduce<FuelMileage | null>(
    (best, item) => (best && best.breakdown.litres >= item.breakdown.litres ? best : item),
    null,
  );
  return {
    kmpl: dominant?.breakdown.kmpl ?? null,
    fuel_type: dominant?.fuelType ?? null,
    method: "tankful" as const,
    by_fuel_type: serialiseMileage(byFuel),
    unavailable_reason: byFuel.length > 0 ? null : mileageUnavailableReason(logs),
    /** The dominant fuel's window — what the fleet average is weighted by. */
    window: dominant ? { distance_km: dominant.breakdown.distanceKm, litres: dominant.breakdown.litres } : null,
  };
}

/** Fuel + distance figures for one vehicle over one window. */
function summarise(logs: FuelLogEntry[], distanceKm: number) {
  const litres = round(logs.reduce((sum, log) => sum + (log.fuel_litres ?? 0), 0));
  const cost = round(logs.reduce((sum, log) => sum + (log.fuel_amount ?? 0), 0));
  const dates = logs.map((log) => log.log_date).sort();
  const km = round(distanceKm);

  return {
    fill_ups: logs.length,
    fuel_litres: litres,
    fuel_cost_inr: cost,
    avg_rate_per_litre_inr: litres > 0 && cost > 0 ? round(cost / litres) : null,
    distance_km: km,
    cost_per_km_inr: km > 0 && cost > 0 ? round(cost / km) : null,
    first_fill_date: dates[0] ?? null,
    last_fill_date: dates[dates.length - 1] ?? null,
    fuel_types_used: Array.from(new Set(logs.map((log) => log.fuel_type).filter(Boolean))),
    mileage: buildMileage(logs),
  };
}

/** One fill-up, as returned under `include=logs`. */
function serialiseLog(log: FuelLogEntry) {
  const litres = log.fuel_litres ?? 0;
  return {
    date: log.log_date,
    logged_at: log.logged_at ?? null,
    fuel_type: log.fuel_type,
    litres,
    amount_inr: log.fuel_amount,
    rate_per_litre_inr: litres > 0 && log.fuel_amount ? round(log.fuel_amount / litres) : null,
    // km driven since the PREVIOUS fill of the same fuel type (GPS, not odometer).
    segment_distance_km: log.gps_distance_km,
    // Indicative per-entry figure — exactly what the vehicle's Fuel Logs tab shows.
    // The reliable number is the tankful `mileage` above, not this one.
    entry_kmpl: log.gps_distance_km != null && litres > 0 ? round(log.gps_distance_km / litres, 1) : null,
    gps_synced_at: log.gps_synced_at,
    recorded_by: log.recorded_by,
    notes: log.notes || null,
  };
}

// ── Live GPS refresh ─────────────────────────────────────────────────────────
// Every response carries GPS distance and mileage, so before answering we pull
// fresh distances from the tracking providers — the same two syncs the Fuel
// Dashboard's "Sync GPS Data" button runs (lib/gps-distance.ts).
//
// It is throttled rather than run blindly, because this endpoint is public and a
// sync is one HTTP call per tracked vehicle against Millitrack / WheelsEye:
//
//   - `refresh=auto` (default) syncs only when the selection's GPS data is older
//     than FRESH_MS, so back-to-back callers share one sync instead of hammering
//     the providers (and getting the fleet's account rate-limited).
//   - `refresh=force` skips that window but still honours HARD_FLOOR_MS.
//   - `refresh=off` serves what's already stored — the fast path.
//
// The sync is scoped to the vehicles the request actually selected, so
// `?reg=UP41CT6926&refresh=force` costs one provider call, not fifty.

/** Data younger than this is treated as fresh under `refresh=auto`. */
const FRESH_MS = 5 * 60 * 1000;
/** No sync ever runs closer together than this, `refresh=force` included. */
const HARD_FLOOR_MS = 60 * 1000;
/** Answer even if the providers are slow; the stored data is still returned. */
const SYNC_BUDGET_MS = 45 * 1000;

type RefreshMode = "auto" | "force" | "off";

type GpsSyncReport = {
  ran: boolean;
  mode: RefreshMode;
  reason: string | null;
  vehicles_synced?: number;
  months_updated?: number;
  segments_updated?: number;
  failed?: number;
  took_ms?: number;
  timed_out?: boolean;
  error?: string;
  data_synced_at: string | null;
};

/**
 * One sync at a time per server instance. Concurrent callers await the same run
 * instead of each firing their own volley at the GPS providers.
 */
let inFlightSync: Promise<{ vehicles: number; months: number; segments: number; failed: number }> | null = null;

async function runSync(ids: Set<string>, syncMonthly: boolean) {
  if (inFlightSync) return inFlightSync;
  inFlightSync = (async () => {
    // Monthly distance only ever moves for the current month, so a past-month
    // query gains nothing from that half and we skip it. Segment distances feed
    // mileage in every month, so those always run.
    const monthly = syncMonthly ? await syncMonthlyGpsDistance(ids) : null;
    const segments = await syncFuelSegmentDistances(ids);
    return {
      vehicles: Math.max(monthly?.vehicles ?? 0, segments.vehicles),
      months: monthly?.months ?? 0,
      segments: segments.segments,
      failed: (monthly?.failed ?? 0) + segments.failed,
    };
  })();
  try {
    return await inFlightSync;
  } finally {
    inFlightSync = null;
  }
}

async function refreshGps(selected: FleetVehicle[], period: Period, mode: RefreshMode): Promise<GpsSyncReport> {
  const currentMonth = currentYearMonth();
  const tracked = selected.filter((vehicle) => Boolean(vehicle.gps_device_id));

  // Freshness comes from the current-month rows: a tracked vehicle with no row
  // has never been synced this month and counts as stale.
  const syncedAt = await getGpsSyncTimes(currentMonth);
  const stamps = tracked
    .map((vehicle) => syncedAt.get(vehicle.vehicle_id))
    .filter((stamp): stamp is string => Boolean(stamp))
    .map((stamp) => Date.parse(stamp))
    .filter((ms) => !Number.isNaN(ms));
  const newest = stamps.length > 0 ? Math.max(...stamps) : null;
  const oldest = stamps.length === tracked.length && stamps.length > 0 ? Math.min(...stamps) : null;
  const lastSyncedAt = newest ? new Date(newest).toISOString() : null;

  const skip = (reason: string): GpsSyncReport => ({ ran: false, mode, reason, data_synced_at: lastSyncedAt });

  if (mode === "off") return skip("refresh=off — serving stored GPS data");
  if (tracked.length === 0) return skip("no GPS-tracked vehicles in this selection");

  const sinceNewest = newest ? Date.now() - newest : Number.POSITIVE_INFINITY;
  if (sinceNewest < HARD_FLOOR_MS) {
    return skip(`synced ${Math.round(sinceNewest / 1000)}s ago — inside the ${HARD_FLOOR_MS / 1000}s minimum interval`);
  }
  // `oldest` is null when some tracked vehicle has no row at all → stale.
  if (mode === "auto" && oldest !== null && Date.now() - oldest < FRESH_MS) {
    return skip(`already synced within the last ${FRESH_MS / 60000} minutes`);
  }

  const startedAt = Date.now();
  const ids = new Set(tracked.map((vehicle) => vehicle.vehicle_id));
  const syncMonthly = period.allTime || (period.months?.includes(currentMonth) ?? false);

  try {
    const timeout = Symbol("timeout");
    const result = await Promise.race([
      runSync(ids, syncMonthly),
      new Promise<typeof timeout>((resolve) => setTimeout(() => resolve(timeout), SYNC_BUDGET_MS)),
    ]);

    if (result === timeout) {
      // The sync keeps running; we answer now with whatever has already landed
      // rather than letting the request hit the platform's hard timeout.
      return {
        ran: true,
        mode,
        reason: `GPS providers still responding after ${SYNC_BUDGET_MS / 1000}s — returning the data synced so far`,
        timed_out: true,
        took_ms: Date.now() - startedAt,
        data_synced_at: lastSyncedAt,
      };
    }

    return {
      ran: true,
      mode,
      reason: null,
      vehicles_synced: result.vehicles,
      months_updated: result.months,
      segments_updated: result.segments,
      failed: result.failed,
      took_ms: Date.now() - startedAt,
      timed_out: false,
      data_synced_at: new Date().toISOString(),
    };
  } catch (error) {
    // A provider outage must not take the endpoint down — serve stored data.
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/public/fuel] GPS refresh failed:", message);
    return {
      ran: false,
      mode,
      reason: "GPS refresh failed — serving the last stored data",
      error: message,
      took_ms: Date.now() - startedAt,
      data_synced_at: lastSyncedAt,
    };
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const docs = `${origin}/api-docs`;

  const badRequest = (message: string, hint: string) =>
    NextResponse.json({ error: "bad_request", message, hint, docs }, { status: 400, headers: CORS });

  // ── Period ────────────────────────────────────────────────────────────────
  const period = resolvePeriod(searchParams);
  if ("error" in period) return badRequest(period.error, period.hint);

  // ── Filters ───────────────────────────────────────────────────────────────
  const statusParam = (searchParams.get("status") ?? "active").trim().toLowerCase();
  let statuses: VehicleStatus[] | null = null; // null → every status
  if (statusParam !== "all") {
    const wanted = statusParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const invalid = wanted.filter((value) => !VEHICLE_STATUSES.includes(value as VehicleStatus));
    if (invalid.length > 0) {
      return badRequest(
        `Unknown status ${invalid.map((value) => `"${value}"`).join(", ")}.`,
        `Valid values: ${VEHICLE_STATUSES.join(", ")} — or status=all.`,
      );
    }
    statuses = wanted as VehicleStatus[];
  }

  const ownership = (searchParams.get("ownership") ?? "").trim().toLowerCase();
  if (ownership && ownership !== "company" && ownership !== "vendor") {
    return badRequest(`Unknown ownership "${ownership}".`, "Valid values: company, vendor.");
  }

  const include = new Set(
    (searchParams.get("include") ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  const withLogs = include.has("logs") || include.has("all");
  const withMonths = include.has("months") || include.has("all");

  const SORTS = ["frt", "registration", "fills", "litres", "cost", "km", "mileage"];
  const sort = (searchParams.get("sort") ?? "frt").trim().toLowerCase();
  if (!SORTS.includes(sort)) return badRequest(`Unknown sort "${sort}".`, `Valid values: ${SORTS.join(", ")}.`);

  const order = (searchParams.get("order") ?? "").trim().toLowerCase();
  if (order && order !== "asc" && order !== "desc") {
    return badRequest(`Unknown order "${order}".`, "Valid values: asc, desc.");
  }

  const refreshParam = (searchParams.get("refresh") ?? "auto").trim().toLowerCase();
  const REFRESH_ALIASES: Record<string, RefreshMode> = {
    auto: "auto",
    force: "force",
    "1": "force",
    true: "force",
    yes: "force",
    off: "off",
    "0": "off",
    false: "off",
    no: "off",
  };
  const refresh = REFRESH_ALIASES[refreshParam];
  if (!refresh) {
    return badRequest(`Unknown refresh "${refreshParam}".`, "Valid values: auto (default), force, off.");
  }

  const filters = {
    reg: (searchParams.get("reg") ?? "").trim(),
    frt: (searchParams.get("frt") ?? "").trim(),
    circle: (searchParams.get("circle") ?? "").trim(),
    division: (searchParams.get("division") ?? "").trim(),
    substation: (searchParams.get("substation") ?? "").trim(),
    vendor: (searchParams.get("vendor") ?? "").trim(),
  };

  // ── Data (whole fleet — no profile means no permission filtering) ──────────
  const vehicles = await getVehicles();

  // A location filter matches either the UUID or a case-insensitive part of the name.
  const matchesLocation = (name: string | null, id: string | null, query: string) => {
    if (!query) return true;
    const wanted = norm(query);
    return norm(id ?? "") === wanted || norm(name ?? "").includes(wanted);
  };
  // frt=3, frt=FRT 3 and frt=frt3 all mean the same posting.
  const matchesFrt = (frtNo: string | null, query: string) => {
    if (!query) return true;
    const stored = norm(frtNo ?? "");
    const wanted = norm(query);
    return Boolean(stored) && (stored === wanted || stored === `frt${wanted}`);
  };

  const selected = vehicles.filter(
    (vehicle) =>
      (statuses === null || statuses.includes(vehicle.status)) &&
      (!ownership || vehicle.fuel_ownership === ownership) &&
      (!filters.reg || norm(vehicle.registration_no).includes(norm(filters.reg))) &&
      matchesFrt(vehicle.frt_no, filters.frt) &&
      matchesLocation(vehicle.current_circle ?? vehicle.home_circle, vehicle.current_circle_id, filters.circle) &&
      matchesLocation(vehicle.division, vehicle.division_id, filters.division) &&
      matchesLocation(vehicle.substation, vehicle.substation_id, filters.substation) &&
      (!filters.vendor || norm(vehicle.vendor_name ?? "").includes(norm(filters.vendor))),
  );

  // Pull fresh distances from the GPS providers BEFORE reading the fuel logs and
  // distance rows, so the mileage below is computed on what was just written.
  // (Both readers are cache()-wrapped per request and are first called after this.)
  const gpsSync = await refreshGps(selected, period, refresh);

  const [allLogs, gpsRows] = await Promise.all([getAllFuelLogs(), getAllGpsDistance()]);

  const logsByVehicle = new Map<string, FuelLogEntry[]>();
  for (const log of allLogs) {
    const bucket = logsByVehicle.get(log.vehicle_id);
    if (bucket) bucket.push(log);
    else logsByVehicle.set(log.vehicle_id, [log]);
  }

  const gpsByVehicle = new Map<string, Map<string, number>>();
  for (const row of gpsRows) {
    const bucket = gpsByVehicle.get(row.vehicle_id) ?? new Map<string, number>();
    bucket.set(row.year_month, row.distance_km);
    gpsByVehicle.set(row.vehicle_id, bucket);
  }

  const inPeriod = (log: FuelLogEntry) => log.log_date >= period.fromDate && log.log_date <= period.toDate;
  const distanceFor = (months: Map<string, number> | undefined, wanted: string[] | null) => {
    if (!months) return 0;
    if (wanted === null) return Array.from(months.values()).reduce((sum, km) => sum + km, 0);
    return wanted.reduce((sum, month) => sum + (months.get(month) ?? 0), 0);
  };

  const rows = selected.map((vehicle) => {
    const vehicleLogs = logsByVehicle.get(vehicle.vehicle_id) ?? [];
    const periodLogs = period.allTime ? vehicleLogs : vehicleLogs.filter(inPeriod);
    const gpsMonths = gpsByVehicle.get(vehicle.vehicle_id);

    const monthly = withMonths
      ? monthlyWindows(period, vehicleLogs, gpsMonths).map((month) => ({
          year_month: month.yearMonth,
          label: monthLabel(month.yearMonth),
          ...summarise(month.logs, month.distanceKm),
        }))
      : undefined;

    return {
      vehicle_id: vehicle.vehicle_id,
      registration_no: vehicle.registration_no,
      frt_no: vehicle.frt_no,
      status: vehicle.status,
      fuel_ownership: vehicle.fuel_ownership,
      vehicle: {
        type: vehicle.vehicle_type,
        fuel_type: vehicle.fuel_type,
        model_year: vehicle.model_year,
        owner_name: vehicle.owner_name,
        vendor_name: vehicle.vendor_name,
        driver_ownership: vehicle.driver_ownership,
        notes: vehicle.notes || null,
      },
      location: {
        circle: vehicle.current_circle ?? vehicle.home_circle,
        division: vehicle.division,
        substation: vehicle.substation,
        home_circle: vehicle.home_circle,
        assigned_from: vehicle.assigned_from,
      },
      gps: {
        company: vehicle.gps_company,
        device_id: vehicle.gps_device_id,
        tracked: Boolean(vehicle.gps_device_id),
      },
      period: {
        ...summarise(periodLogs, distanceFor(gpsMonths, period.months)),
        // Newest fill first, matching the vehicle's Fuel Logs tab.
        ...(withLogs
          ? { logs: [...periodLogs].sort((a, b) => b.log_date.localeCompare(a.log_date)).map(serialiseLog) }
          : {}),
      },
      all_time: {
        ...summarise(vehicleLogs, distanceFor(gpsMonths, null)),
        months_with_gps_data: gpsMonths ? gpsMonths.size : 0,
      },
      ...(monthly ? { monthly } : {}),
    };
  });

  sortRows(rows, sort, order as "asc" | "desc" | "");

  // ── Fleet roll-up — the same rules as the dashboard's summary strip ────────
  // Fill-ups / litres / cost count company-fuelled vehicles only (the company does
  // not pay for vendor fuel); distance covers every vehicle in the selection.
  const company = rows.filter((row) => row.fuel_ownership === "company");
  const mileageKm = company.reduce((sum, row) => sum + (row.period.mileage.window?.distance_km ?? 0), 0);
  const mileageLitres = company.reduce((sum, row) => sum + (row.period.mileage.window?.litres ?? 0), 0);

  // For month=all the window has no fixed edges, so report the data's own edges.
  const fillDates = rows
    .flatMap((row) => [row.period.first_fill_date, row.period.last_fill_date])
    .filter((date): date is string => Boolean(date))
    .sort();

  return NextResponse.json(
    {
      meta: {
        generated_at: new Date().toISOString(),
        timezone: "Asia/Kolkata",
        currency: "INR",
        source: "FRT Vehicle Management System",
        docs,
        period: {
          label: period.label,
          all_time: period.allTime,
          months: period.months,
          from: period.allTime ? (fillDates[0] ?? null) : period.fromDate,
          to: period.allTime ? (fillDates[fillDates.length - 1] ?? null) : period.toDate,
        },
        filters: {
          status: statuses ?? "all",
          ownership: ownership || null,
          ...Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, value || null])),
          sort,
          order: order || null,
          include: Array.from(include),
          refresh,
        },
        gps_sync: gpsSync,
        vehicle_count: rows.length,
        fleet_size: vehicles.length,
      },
      totals: {
        vehicles: rows.length,
        company_fuelled_vehicles: company.length,
        vendor_fuelled_vehicles: rows.length - company.length,
        fill_ups: company.reduce((sum, row) => sum + row.period.fill_ups, 0),
        fuel_litres: round(company.reduce((sum, row) => sum + row.period.fuel_litres, 0)),
        fuel_cost_inr: round(company.reduce((sum, row) => sum + row.period.fuel_cost_inr, 0)),
        distance_km: round(rows.reduce((sum, row) => sum + row.period.distance_km, 0)),
        company_fuel_distance_km: round(company.reduce((sum, row) => sum + row.period.distance_km, 0)),
        average_mileage_kmpl: mileageLitres > 0 ? round(mileageKm / mileageLitres, 1) : null,
      },
      vehicles: rows,
    },
    { headers: CORS },
  );
}

/** Months to report per vehicle: the requested range, or every month that has data. */
function monthlyWindows(period: Period, vehicleLogs: FuelLogEntry[], gpsMonths: Map<string, number> | undefined) {
  const months =
    period.months ??
    Array.from(
      new Set([
        ...vehicleLogs.map((log) => log.log_date.slice(0, 7)),
        ...(gpsMonths ? Array.from(gpsMonths.keys()) : []),
      ]),
    ).sort();

  return months.map((yearMonth) => ({
    yearMonth,
    logs: vehicleLogs.filter((log) => log.log_date.startsWith(yearMonth)),
    distanceKm: gpsMonths?.get(yearMonth) ?? 0,
  }));
}

type SortableRow = {
  registration_no: string;
  frt_no: string | null;
  period: {
    fill_ups: number;
    fuel_litres: number;
    fuel_cost_inr: number;
    distance_km: number;
    mileage: { kmpl: number | null };
  };
};

/** FRT order by default (FRT 2 before FRT 10, unnumbered last); metrics high→low. */
function sortRows(rows: SortableRow[], sort: string, order: "asc" | "desc" | "") {
  if (sort === "frt") {
    const rank = (frtNo: string | null) => {
      const match = frtNo?.match(/\d+/);
      return match ? parseInt(match[0], 10) : Number.POSITIVE_INFINITY;
    };
    rows.sort((a, b) => rank(a.frt_no) - rank(b.frt_no) || a.registration_no.localeCompare(b.registration_no));
    if (order === "desc") rows.reverse();
    return;
  }

  if (sort === "registration") {
    rows.sort((a, b) => a.registration_no.localeCompare(b.registration_no));
    if (order === "desc") rows.reverse();
    return;
  }

  const value = (row: SortableRow) => {
    switch (sort) {
      case "fills":
        return row.period.fill_ups;
      case "litres":
        return row.period.fuel_litres;
      case "cost":
        return row.period.fuel_cost_inr;
      case "km":
        return row.period.distance_km;
      default:
        return row.period.mileage.kmpl ?? -1; // unmeasured vehicles sink to the bottom
    }
  };
  rows.sort((a, b) => value(b) - value(a) || a.registration_no.localeCompare(b.registration_no));
  if (order === "asc") rows.reverse();
}
