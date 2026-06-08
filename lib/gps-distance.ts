// Server-only module: imported solely by server actions and the cron route handler.
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isMillitrackConfigured, millitrackSummary } from "@/lib/millitrack";

/**
 * Standalone monthly GPS distance sync — independent of fuel logs.
 *
 * For every vehicle that has a numeric Millitrack device id (gps_device_id),
 * fetch the distance for the current month [month start → now] and upsert it
 * into vehicle_gps_distance keyed by (vehicle_id, year_month). Past months stay
 * frozen; the current month's row updates on each run, building month-wise history.
 *
 * On the 1st–2nd of a month we also re-sync the just-ended previous month so its
 * total is finalized over the full month range.
 *
 * Shared by the manual button (server action) and the daily Vercel cron route.
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

export async function syncMonthlyGpsDistance(): Promise<MonthlySyncResult> {
  if (!isMillitrackConfigured()) {
    return { ok: false, reason: "Millitrack not configured (set MT_USERNAME/MT_EMAIL + MT_PASSWORD)", vehicles: 0, months: 0, failed: 0 };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, reason: "Database connection not available", vehicles: 0, months: 0, failed: 0 };

  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("id,registration_no,gps_device_id")
    .not("gps_device_id", "is", null);
  if (error) return { ok: false, reason: error.message, vehicles: 0, months: 0, failed: 0 };

  const candidates = (vehicles ?? []).filter((v) => v.gps_device_id && /^\d+$/.test(String(v.gps_device_id).trim()));

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

  const CHUNK = 5; // limit concurrency so we don't hammer the GPS API / blow the timeout
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const batch = candidates.slice(i, i + CHUNK);
    await Promise.all(
      batch.map(async (v) => {
        for (const t of targets) {
          const startISO = istMonthStart(t.year, t.monthIdx).toISOString();
          const monthEnd = istMonthStart(t.year, t.monthIdx + 1);
          const endISO = monthEnd > now ? nowISO : monthEnd.toISOString(); // cap current month at "now"
          try {
            const rows = await millitrackSummary(String(v.gps_device_id), startISO, endISO);
            const km = rows.reduce((sum, r) => sum + (r.distance ?? 0) / 1000, 0);
            const { error: upErr } = await supabase
              .from("vehicle_gps_distance")
              .upsert(
                { vehicle_id: v.id, year_month: ymOf(t.year, t.monthIdx), distance_km: +km.toFixed(2), synced_at: nowISO },
                { onConflict: "vehicle_id,year_month" },
              );
            if (upErr) throw new Error(upErr.message);
            months += 1;
            touched.add(v.id);
          } catch (e) {
            console.error(`[gps-monthly] ${v.registration_no}:`, e instanceof Error ? e.message : e);
            failed += 1;
          }
        }
      }),
    );
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
