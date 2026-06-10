// Server-only module: imported solely by server actions and the cron route handler.
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isMillitrackConfigured, millitrackSummary } from "@/lib/millitrack";
import { isWheelsEyeConfigured, wheelsEyeDistanceByReg } from "@/lib/wheelseye";

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
const normReg = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

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
          const km = kmByReg.get(normReg(v.registration_no));
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
