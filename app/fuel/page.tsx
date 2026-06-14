import Link from "next/link";
import { Droplets, Fuel, Plus, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { DismissibleBanner } from "@/components/ui/dismissible-banner";
import { PageHeader } from "@/components/shared/PageHeader";
import { MonthNavigator } from "@/components/fuel/MonthNavigator";
import { requireProfile } from "@/lib/auth";
import {
  getAllLookups,
  getFuelLogsForMonth,
  getGpsDistanceForMonth,
  getVehicles,
  preloadFleetData,
  preloadFuelMonthData,
} from "@/lib/data";
import { canCreateVehicle, canEditVehicle } from "@/lib/permissions";
import { syncGpsMonthlyDistanceAction } from "@/lib/actions/gps-actions";
import { currentYearMonth, isValidYearMonth } from "@/lib/utils/month";

export const dynamic = "force-dynamic";
// Allow up to 60s for the GPS sync action (one Millitrack call per vehicle).
export const maxDuration = 60;

export default async function FuelDashboardPage({
  searchParams,
}: {
  searchParams: {
    m?: string;
    msync?: string;
    vehicles?: string;
    months?: string;
    failed?: string;
    reason?: string;
    from?: string;
    to?: string;
  };
}) {
  const currentMonthStr = currentYearMonth();
  const yearMonth = isValidYearMonth(searchParams.m) ? searchParams.m : currentMonthStr;

  // Start the data queries while the auth round trips are still in flight.
  preloadFleetData();
  preloadFuelMonthData(yearMonth);
  const profile = await requireProfile();

  const [vehicles, fuelLogs, gpsDistance, lookups] = await Promise.all([
    getVehicles(profile),
    getFuelLogsForMonth(profile, yearMonth),
    getGpsDistanceForMonth(yearMonth),
    getAllLookups(),
  ]);

  const activeVehicles = vehicles.filter((v) => v.status !== "removed");

  const logsByVehicle = new Map<string, typeof fuelLogs>();
  for (const log of fuelLogs) {
    if (!logsByVehicle.has(log.vehicle_id)) logsByVehicle.set(log.vehicle_id, []);
    logsByVehicle.get(log.vehicle_id)!.push(log);
  }

  // Monthly GPS distance (set by "Sync GPS Data") for the selected month.
  const gpsKmByVehicle = new Map<string, number>();
  for (const row of gpsDistance) gpsKmByVehicle.set(row.vehicle_id, row.distance_km);

  const frtSortKey = (frt_no: string | null | undefined) => {
    const match = frt_no?.match(/\d+/);
    return match ? parseInt(match[0], 10) : Number.POSITIVE_INFINITY;
  };

  const rows = activeVehicles.map((v) => {
    const logs = logsByVehicle.get(v.vehicle_id) ?? [];
    // Round the float sum — adding decimals (e.g. 5.5 + 8.69) leaves artifacts like 14.190000000000001.
    const totalLitres = +logs.reduce((sum, l) => sum + (l.fuel_litres ?? 0), 0).toFixed(2);
    const totalAmount = logs.reduce((sum, l) => sum + (l.fuel_amount ?? 0), 0);
    const gpsKm = gpsKmByVehicle.get(v.vehicle_id) ?? 0;
    // Average only when BOTH fuel and GPS distance exist — no fuel => no average (avoids confusion).
    const avg = totalLitres > 0 && gpsKm > 0 ? +(gpsKm / totalLitres).toFixed(1) : null;
    const hasGps = Boolean(v.gps_device_id);
    const canManage = canEditVehicle(profile, v, lookups);
    return { vehicle: v, logs, totalLitres, totalAmount, gpsKm, avg, hasGps, canManage };
  }).sort((a, b) => frtSortKey(a.vehicle.frt_no) - frtSortKey(b.vehicle.frt_no));

  const companyRows = rows.filter((r) => r.vehicle.fuel_ownership === "company");
  const grandLitres = +companyRows.reduce((sum, r) => sum + r.totalLitres, 0).toFixed(2);
  const grandAmount = companyRows.reduce((sum, r) => sum + r.totalAmount, 0);
  const grandKm = rows.reduce((sum, r) => sum + r.gpsKm, 0);
  // "Company distance" and the fleet average count every vehicle the company is
  // responsible for fuelling (fuel_ownership === "company"), regardless of whether
  // fuel was logged this month. Vendor-fuelled vehicles are excluded — the company
  // doesn't fuel them. The average reconciles as companyKm / grandLitres.
  const companyKm = companyRows.reduce((sum, r) => sum + r.gpsKm, 0);
  const grandAvg = grandLitres > 0 && companyKm > 0 ? +(companyKm / grandLitres).toFixed(1) : null;

  // GPS sync is open to vehicle managers; the action itself scopes each role to
  // the vehicles it can edit (super_admin syncs the whole fleet).
  const canSyncGps = canCreateVehicle(profile);
  const canAddFuel = profile.role !== "viewer";

  const syncBanner = (() => {
    if (searchParams.msync === "ok") {
      const vehiclesCount = Number(searchParams.vehicles) || 0;
      const failedCount = Number(searchParams.failed) || 0;
      const range =
        searchParams.from && searchParams.to
          ? ` · data from ${fmtIST(searchParams.from)} to ${fmtIST(searchParams.to)} (IST)`
          : "";
      const failedPart = failedCount > 0 ? `, ${failedCount} failed` : "";
      // Every vehicle failing is a failed sync, not a success — show it red.
      if (failedCount > 0 && vehiclesCount === 0) {
        return {
          tone: "error" as const,
          message: `GPS sync failed — 0 vehicles updated, ${failedCount} failed.`,
        };
      }
      return {
        tone: "success" as const,
        message: `GPS data synced — ${vehiclesCount} vehicles updated${range}${failedPart}.`,
      };
    }
    if (searchParams.msync === "error") {
      return { tone: "error" as const, message: `Monthly distance sync failed: ${searchParams.reason ?? "unknown error"}` };
    }
    return null;
  })();

  return (
    <AppShell profile={profile}>
      <PageHeader title="Fuel Dashboard" eyebrow="Monthly fuel summary per vehicle">
        {canAddFuel && (
          <LinkButton href="/fuel-log/add">
            <Fuel className="h-4 w-4" aria-hidden="true" />
            Add Fuel
          </LinkButton>
        )}
        {/* Desktop: Sync lives in the header. On mobile it moves into the empty
            summary-grid cell below to save vertical space at the top. */}
        {canSyncGps && (
          <form action={syncGpsMonthlyDistanceAction} className="hidden sm:block">
            <SubmitButton variant="outline">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Sync GPS Data
            </SubmitButton>
          </form>
        )}
      </PageHeader>

      {/* Sync result banner — auto-dismisses after a few seconds */}
      {syncBanner && <DismissibleBanner tone={syncBanner.tone} message={syncBanner.message} />}

      <MonthNavigator basePath="/fuel" yearMonth={yearMonth} />

      {/* Summary strip — compact 3-col grid on mobile, inline row on sm+ */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-1.5">
          <Stat value={grandKm > 0 ? `${Math.round(grandKm).toLocaleString("en-IN")} km` : "—"} label="total distance" />
          <Stat value={companyKm > 0 ? `${Math.round(companyKm).toLocaleString("en-IN")} km` : "—"} label="company fuel distance" />
          <Stat value={grandLitres > 0 ? `${grandLitres} L` : "—"} label="total fuel" />
          <Stat value={grandAvg !== null ? `${grandAvg} km/L` : "—"} label="average" />
          <Stat value={grandAmount > 0 ? `₹${grandAmount.toLocaleString("en-IN")}` : "—"} label="total cost" />
          {/* Fills the empty 6th cell on mobile; the header copy handles sm+ */}
          {canSyncGps && (
            <form action={syncGpsMonthlyDistanceAction} className="flex items-center sm:hidden">
              <SubmitButton variant="outline" className="h-9 w-full gap-1.5 px-2 text-xs">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Sync GPS
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      {/* Vehicle table */}
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
            <Droplets className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No vehicles in your scope</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] divide-y divide-slate-200 text-xs sm:min-w-[760px] sm:text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 sm:px-5 sm:py-3">Vehicle</th>
                    <th className="px-3 py-2.5 sm:px-5 sm:py-3">Location</th>
                    <th className="px-3 py-2.5 sm:px-5 sm:py-3">Fuel By</th>
                    <th className="px-3 py-2.5 sm:px-5 sm:py-3 text-right">Entries</th>
                    <th className="px-3 py-2.5 sm:px-5 sm:py-3 text-right">Fuel (L)</th>
                    <th className="px-3 py-2.5 sm:px-5 sm:py-3 text-right">Cost (₹)</th>
                    <th className="px-3 py-2.5 sm:px-5 sm:py-3 text-right">KM (GPS)</th>
                    <th className="px-3 py-2.5 sm:px-5 sm:py-3 text-right">Avg km/L</th>
                    <th className="px-3 py-2.5 sm:px-5 sm:py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ vehicle, logs, totalLitres, totalAmount, gpsKm, avg, hasGps, canManage }) => {
                    const isCompany = vehicle.fuel_ownership === "company";
                    return (
                      <tr key={vehicle.vehicle_id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 sm:px-5 sm:py-3.5">
                          <Link
                            href={`/vehicles/${vehicle.vehicle_id}?tab=Fuel+Logs`}
                            className="font-semibold text-slate-900 hover:underline"
                          >
                            {vehicle.registration_no}
                          </Link>
                          <p className="text-xs text-slate-400">{vehicle.vendor_name ?? "—"}</p>
                        </td>
                        <td className="px-3 py-3 sm:px-5 sm:py-3.5">
                          <span className="block font-semibold text-slate-700">
                            {vehicle.substation ?? "—"}{vehicle.frt_no ? ` (${vehicle.frt_no})` : ""}
                          </span>
                          <span className="text-xs text-slate-400">{vehicle.division ?? "Unassigned"}</span>
                        </td>
                        <td className="px-3 py-3 sm:px-5 sm:py-3.5">
                          <Badge tone={isCompany ? "blue" : "yellow"}>
                            {isCompany ? "Company" : "Vendor"}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 sm:px-5 sm:py-3.5 text-right">
                          {isCompany ? (
                            <span className={logs.length > 0 ? "font-semibold text-slate-900" : "text-slate-400"}>
                              {logs.length}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 sm:px-5 sm:py-3.5 text-right">
                          {isCompany && totalLitres > 0 ? (
                            <span className="font-medium text-slate-900">{totalLitres}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 sm:px-5 sm:py-3.5 text-right">
                          {isCompany && totalAmount > 0 ? (
                            <span className="font-medium text-slate-900">
                              {totalAmount.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 sm:px-5 sm:py-3.5 text-right text-slate-600">
                          {hasGps ? (
                            <span className={gpsKm > 0 ? "font-medium text-slate-900" : "text-slate-400"}>
                              {gpsKm.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 sm:px-5 sm:py-3.5 text-right">
                          {avg !== null ? (
                            <Badge tone="green">{avg}</Badge>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 sm:px-5 sm:py-3.5 text-right">
                          {isCompany && canManage && (
                            <Link
                              href={`/vehicles/${vehicle.vehicle_id}?tab=Fuel+Logs`}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Plus className="h-3 w-3" />
                              Add Entry
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/** Compact summary metric — value above label on mobile, inline on sm+. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1.5">
      <span className="text-sm font-bold tabular-nums text-slate-900 sm:text-base">{value}</span>
      <span className="text-[11px] text-slate-500 sm:text-sm">{label}</span>
    </span>
  );
}

/** Format an ISO timestamp as a readable IST date-time, e.g. "01 Jun 2026, 12:00 AM". */
function fmtIST(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}
