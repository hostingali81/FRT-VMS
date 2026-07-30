// Server-only module: imported solely by server actions and the cron route handler.
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isMillitrackConfigured, millitrackSummary } from "@/lib/millitrack";
import { isWheelsEyeConfigured, wheelsEyeDistanceByReg, wheelsEyeDistanceKey } from "@/lib/wheelseye";

/**
 * Standalone monthly GPS distance sync — independent of fuel logs.
 *
 * Provider-aware: a vehicle's gps_company decides which platform we pull from.
 *   - "VehicleStep" → Millitrack (one summary call per vehicle, per month)
 *   - "WheelsEye"   → WheelsEye  (one report call covers all vehicles, per month)
 *
 * For each vehicle we upsert the distance for the current month [month start → now]
 * into vehicle_gps_distance keyed by (vehicle_id, year_month). Past months stay
 * frozen; the current month's row updates on each run, building month-wise history.
 * On the 1st–2nd we also re-sync the just-ended previous month to finalize it.
 *
 * Shared by the manual button (server action) and the daily Vercel cron route.
 *
 * `allowedVehicleIds` scopes the sync: when a Set is passed, only those vehicle
 * ids are synced (used by non-admin roles so a circle/division incharge refreshes
 * only their own vehicles). Pass null/undefined (cron, super_admin) to sync the
 * whole GPS-mapped fleet.
 */
export type MonthlySyncResult = {
  ok: boolean;
  reason?: string;
  vehicles: number; // distinct vehicles touched
  months: number; // month-rows upserted
  failed: number;
  from?: string; // ISO: current month start (IST) that distance is measured from
  to?: string; // ISO: sync instant (the "till" point)
};

const ymOf = (year: number, monthIdx: number) => `${year}-${String(monthIdx + 1).padStart(2, "0")}`;

// India is UTC+5:30. Months are treated as IST calendar months so "month start"
// is 00:00 IST (not 05:30 IST, which a UTC boundary would produce).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istMonthStart = (year: number, monthIdx: number) => new Date(Date.UTC(year, monthIdx, 1) - IST_OFFSET_MS);

export async function syncMonthlyGpsDistance(
  allowedVehicleIds?: Set<string> | null,
): Promise<MonthlySyncResult> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, reason: "Database connection not available", vehicles: 0, months: 0, failed: 0 };

  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("id,registration_no,gps_device_id,gps_company")
    .not("gps_device_id", "is", null);
  if (error) return { ok: false, reason: error.message, vehicles: 0, months: 0, failed: 0 };

  // Scope to the caller's vehicles when an allow-set is given; otherwise sync all.
  const all = (vehicles ?? []).filter((v) => !allowedVehicleIds || allowedVehicleIds.has(v.id));
  const millitrack = all.filter((v) => v.gps_company === "VehicleStep" && /^\d+$/.test(String(v.gps_device_id).trim()));
  const wheelseye = all.filter((v) => v.gps_company === "WheelsEye");

  const now = new Date();
  const nowISO = now.toISOString();
  // Current calendar position in IST.
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const curYear = istNow.getUTCFullYear();
  const curMonth = istNow.getUTCMonth();

  // Current month always; plus the previous month early in a new month to finalize it.
  const targets: { year: number; monthIdx: number }[] = [{ year: curYear, monthIdx: curMonth }];
  if (istNow.getUTCDate() <= 2) {
    const prev = new Date(Date.UTC(curYear, curMonth - 1, 1));
    targets.unshift({ year: prev.getUTCFullYear(), monthIdx: prev.getUTCMonth() });
  }

  let months = 0;
  let failed = 0;
  const touched = new Set<string>();

  const upsert = async (vehicleId: string, year: number, monthIdx: number, km: number) => {
    const { error: upErr } = await supabase
      .from("vehicle_gps_distance")
      .upsert(
        { vehicle_id: vehicleId, year_month: ymOf(year, monthIdx), distance_km: +km.toFixed(2), synced_at: nowISO },
        { onConflict: "vehicle_id,year_month" },
      );
    if (upErr) throw new Error(upErr.message);
  };

  // ── Millitrack: one summary call per vehicle, per month (chunked concurrency) ──
  if (millitrack.length && isMillitrackConfigured()) {
    const CHUNK = 5;
    for (let i = 0; i < millitrack.length; i += CHUNK) {
      const batch = millitrack.slice(i, i + CHUNK);
      await Promise.all(
        batch.map(async (v) => {
          for (const t of targets) {
            const startISO = istMonthStart(t.year, t.monthIdx).toISOString();
            const monthEnd = istMonthStart(t.year, t.monthIdx + 1);
            const endISO = monthEnd > now ? nowISO : monthEnd.toISOString();
            try {
              const rows = await millitrackSummary(String(v.gps_device_id), startISO, endISO);
              const km = rows.reduce((sum, r) => sum + (r.distance ?? 0) / 1000, 0);
              await upsert(v.id, t.year, t.monthIdx, km);
              months += 1;
              touched.add(v.id);
            } catch (e) {
              console.error(`[gps-monthly/millitrack] ${v.registration_no}:`, e instanceof Error ? e.message : e);
              failed += 1;
            }
          }
        }),
      );
    }
  }

  // ── WheelsEye: one report call covers all vehicles, per month ──
  if (wheelseye.length && isWheelsEyeConfigured()) {
    for (const t of targets) {
      const monthStart = istMonthStart(t.year, t.monthIdx);
      const monthEnd = istMonthStart(t.year, t.monthIdx + 1);
      const fromSec = Math.floor(monthStart.getTime() / 1000);
      const toSec = Math.floor((monthEnd > now ? now : monthEnd).getTime() / 1000);
      try {
        const kmByReg = await wheelsEyeDistanceByReg(fromSec, toSec);
        for (const v of wheelseye) {
          // Report rows are keyed by WheelsEye's own registration for the mapped
          // device, which can differ from ours after a device swap.
          const km = kmByReg.get(await wheelsEyeDistanceKey(v.gps_device_id, v.registration_no));
          if (km == null) {
            failed += 1;
            continue;
          }
          try {
            await upsert(v.id, t.year, t.monthIdx, km);
            months += 1;
            touched.add(v.id);
          } catch (e) {
            console.error(`[gps-monthly/wheelseye] ${v.registration_no}:`, e instanceof Error ? e.message : e);
            failed += 1;
          }
        }
      } catch (e) {
        console.error(`[gps-monthly/wheelseye] report ${ymOf(t.year, t.monthIdx)}:`, e instanceof Error ? e.message : e);
        failed += wheelseye.length;
      }
    }
  }

  return {
    ok: true,
    vehicles: touched.size,
    months,
    failed,
    from: istMonthStart(curYear, curMonth).toISOString(),
    to: nowISO,
  };
}

// ── Per-fill segment distance ───────────────────────────────────────────────
// gps_distance_km on each fuel log = GPS distance from the PREVIOUS fill OF THE SAME
// FUEL TYPE to that fill. Monthly and all-time mileage are built per fuel type from
// these segments, so a bi-fuel vehicle's CNG and petrol mileages stay separate and a
// same-day starter top-up doesn't zero out the main fuel's segment. Distinct from the
// monthly distance above.

export type SegmentSyncResult = {
  ok: boolean;
  reason?: string;
  vehicles: number; // vehicles that had at least one segment written
  segments: number; // segments written this run
  failed: number;
};

/**
 * Tile [fromMs, toMs] into contiguous windows that each fall within a single IST
 * calendar month (so each is ≤31 days, under the provider's ~1-month max-period
 * cap), and whose distances sum to the whole-range total. Mirrors the tiling used
 * by the on-demand GPS distance calculator.
 */
function istMonthWindows(fromMs: number, toMs: number): { fromMs: number; toMs: number }[] {
  const windows: { fromMs: number; toMs: number }[] = [];
  let cursor = fromMs;
  while (cursor < toMs) {
    const ist = new Date(cursor + IST_OFFSET_MS);
    const nextMonthStartMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 1) - IST_OFFSET_MS;
    const end = Math.min(nextMonthStartMs, toMs);
    windows.push({ fromMs: cursor, toMs: end });
    cursor = end;
  }
  return windows;
}

type SegmentVehicle = {
  id: string;
  registration_no: string;
  gps_device_id: string | number | null;
  gps_company: string | null;
};

/** Absolute instant for a fill: its exact logged_at if set, else the date's midnight. */
const fuelLogInstant = (log: { log_date: string; logged_at: string | null }) =>
  log.logged_at ? Date.parse(log.logged_at) : Date.parse(`${log.log_date}T00:00:00.000Z`);

/** Distance (km) for one segment window, picking the provider from gps_company. */
async function segmentDistanceKm(
  vehicle: SegmentVehicle,
  fromMs: number,
  toMs: number,
  mtReady: boolean,
  weReady: boolean,
): Promise<number> {
  const windows = istMonthWindows(fromMs, toMs);

  if (vehicle.gps_company === "WheelsEye") {
    if (!weReady) throw new Error("WheelsEye not configured");
    let km = 0;
    for (const w of windows) {
      const byReg = await wheelsEyeDistanceByReg(Math.floor(w.fromMs / 1000), Math.floor(w.toMs / 1000));
      km += byReg.get(await wheelsEyeDistanceKey(vehicle.gps_device_id, vehicle.registration_no)) ?? 0;
    }
    return km;
  }

  // Default: Millitrack / VehicleStep, keyed by numeric device id.
  const deviceId = String(vehicle.gps_device_id ?? "").trim();
  if (!/^\d+$/.test(deviceId)) throw new Error("invalid GPS device id");
  if (!mtReady) throw new Error("Millitrack not configured");
  let km = 0;
  for (const w of windows) {
    const rows = await millitrackSummary(deviceId, new Date(w.fromMs).toISOString(), new Date(w.toMs).toISOString());
    km += rows.reduce((sum, r) => sum + (r.distance ?? 0) / 1000, 0);
  }
  return km;
}

/**
 * Fill in gps_distance_km for every fuel-log segment that doesn't have one yet, for
 * company-fuelled GPS-mapped vehicles. Each segment is measured from the previous
 * fill of the SAME fuel type. One provider call per open segment (tiled if the gap
 * exceeds a month).
 *
 * Already-synced segments are skipped — a closed segment's distance never changes.
 * (Known limitation: inserting a back-dated fill or deleting a middle fill can leave
 * the next segment stale; that needs a manual full re-sync. Tracked as a follow-up.)
 *
 * `allowedVehicleIds` scopes the sync the same way the monthly sync does.
 */
export async function syncFuelSegmentDistances(
  allowedVehicleIds?: Set<string> | null,
): Promise<SegmentSyncResult> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, reason: "Database connection not available", vehicles: 0, segments: 0, failed: 0 };

  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("id,registration_no,gps_device_id,gps_company,fuel_ownership")
    .eq("fuel_ownership", "company")
    .not("gps_device_id", "is", null);
  if (error) return { ok: false, reason: error.message, vehicles: 0, segments: 0, failed: 0 };

  const candidates = (vehicles ?? []).filter((v) => !allowedVehicleIds || allowedVehicleIds.has(v.id));

  const mtReady = isMillitrackConfigured();
  const weReady = isWheelsEyeConfigured();
  const nowISO = new Date().toISOString();

  let vehiclesSynced = 0;
  let segments = 0;
  let failed = 0;

  for (const vehicle of candidates) {
    try {
      const { data: logs } = await supabase
        .from("vehicle_fuel_logs")
        .select("id,log_date,logged_at,created_at,fuel_type,gps_distance_km")
        .eq("vehicle_id", vehicle.id)
        .order("log_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (!logs || logs.length < 2) continue; // need two fills for a segment

      // A fill's segment spans from its previous SAME-TYPE fill (skipping any
      // intervening other-type fills), so bi-fuel vehicles get a real per-type
      // distance instead of a 0-km same-day cross-type gap. Walk once, tracking the
      // last index seen for each fuel type. (A single-fuel vehicle's same-type
      // predecessor is just the immediate predecessor, so its numbers are unchanged.)
      let touched = false;
      const prevIdxByType = new Map<string, number>();
      for (let i = 0; i < logs.length; i++) {
        const typeKey = logs[i].fuel_type ?? "__untyped__";
        const prevIdx = prevIdxByType.get(typeKey);
        prevIdxByType.set(typeKey, i);

        if (prevIdx === undefined) continue; // first fill of this type — no segment
        if (logs[i].gps_distance_km != null) continue; // closed segment — skip

        // Exact fill times when available, else the date's midnight. With times,
        // multiple same-type fills on one day get a real (non-zero) gap.
        const fromMs = fuelLogInstant(logs[prevIdx]);
        const toMs = fuelLogInstant(logs[i]);

        // No measurable gap (same date, no times) → record 0 (not null) so the
        // segment is "closed" and the mileage maths can still proceed.
        const segKm = toMs > fromMs ? await segmentDistanceKm(vehicle, fromMs, toMs, mtReady, weReady) : 0;

        const { error: upErr } = await supabase
          .from("vehicle_fuel_logs")
          .update({ gps_distance_km: +segKm.toFixed(2), gps_synced_at: nowISO })
          .eq("id", logs[i].id);
        if (upErr) throw new Error(upErr.message);

        segments += 1;
        touched = true;
      }

      if (touched) vehiclesSynced += 1;
    } catch (e) {
      console.error(`[gps-segment] ${vehicle.registration_no}:`, e instanceof Error ? e.message : e);
      failed += 1;
    }
  }

  return { ok: true, vehicles: vehiclesSynced, segments, failed };
}
