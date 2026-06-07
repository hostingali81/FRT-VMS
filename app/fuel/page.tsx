import Link from "next/link";
import { Droplets, Fuel, Plus, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { PageHeader } from "@/components/shared/PageHeader";
import { MonthNavigator } from "@/components/fuel/MonthNavigator";
import { requireProfile } from "@/lib/auth";
import { getAllLookups, getFuelLogsForMonth, getVehicles } from "@/lib/data";
import { canEditVehicle } from "@/lib/permissions";
import { syncGpsDistanceAction } from "@/lib/actions/gps-actions";
import { currentYearMonth, isValidYearMonth } from "@/lib/utils/month";

export const dynamic = "force-dynamic";

export default async function FuelDashboardPage({
  searchParams,
}: {
  searchParams: { m?: string; sync?: string; vehicles?: string; segments?: string; failed?: string; reason?: string };
}) {
  const profile = await requireProfile();

  const currentMonthStr = currentYearMonth();
  const yearMonth = isValidYearMonth(searchParams.m) ? searchParams.m : currentMonthStr;

  const [vehicles, fuelLogs, lookups] = await Promise.all([
    getVehicles(profile),
    getFuelLogsForMonth(profile, yearMonth),
    getAllLookups(),
  ]);

  const activeVehicles = vehicles.filter((v) => v.status !== "removed");

  const logsByVehicle = new Map<string, typeof fuelLogs>();
  for (const log of fuelLogs) {
    if (!logsByVehicle.has(log.vehicle_id)) logsByVehicle.set(log.vehicle_id, []);
    logsByVehicle.get(log.vehicle_id)!.push(log);
  }

  const rows = activeVehicles.map((v) => {
    const logs = logsByVehicle.get(v.vehicle_id) ?? [];
    const totalLitres = logs.reduce((sum, l) => sum + (l.fuel_litres ?? 0), 0);
    const totalAmount = logs.reduce((sum, l) => sum + (l.fuel_amount ?? 0), 0);
    // Per fill-up roll-up for the month: GPS km of fills that have it ÷ those fills' litres
    const gpsKm = logs.reduce((sum, l) => sum + (l.gps_distance_km ?? 0), 0);
    const litresWithGps = logs.reduce((sum, l) => sum + (l.gps_distance_km != null ? l.fuel_litres : 0), 0);
    const avg = litresWithGps > 0 ? +(gpsKm / litresWithGps).toFixed(1) : null;
    const canManage = canEditVehicle(profile, v, lookups);
    return { vehicle: v, logs, totalLitres, totalAmount, gpsKm, avg, canManage };
  });

  const companyRows = rows.filter((r) => r.vehicle.fuel_ownership === "company");
  const grandLitres = companyRows.reduce((sum, r) => sum + r.totalLitres, 0);
  const grandAmount = companyRows.reduce((sum, r) => sum + r.totalAmount, 0);
  const grandKm = companyRows.reduce((sum, r) => sum + r.gpsKm, 0);
  const vehiclesLogged = companyRows.filter((r) => r.logs.length > 0).length;

  const isSuperAdmin = profile.role === "super_admin";
  const canAddFuel = profile.role !== "viewer";

  return (
    <AppShell profile={profile}>
      <PageHeader title="Fuel Dashboard" eyebrow="Monthly fuel summary per vehicle">
        {canAddFuel && (
          <LinkButton href="/fuel-log/add">
            <Fuel className="h-4 w-4" aria-hidden="true" />
            Add Fuel
          </LinkButton>
        )}
        {isSuperAdmin && (
          <form action={syncGpsDistanceAction}>
            <SubmitButton variant="outline">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Sync GPS Distance
            </SubmitButton>
          </form>
        )}
      </PageHeader>

      {/* Sync result banner */}
      {searchParams.sync === "ok" && (
        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 sm:px-6 lg:px-8">
          GPS sync complete — {searchParams.vehicles ?? 0} vehicles, {searchParams.segments ?? 0} segments updated
          {Number(searchParams.failed) > 0 ? `, ${searchParams.failed} failed` : ""}.
        </div>
      )}
      {searchParams.sync === "error" && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 sm:px-6 lg:px-8">
          GPS sync failed: {searchParams.reason ?? "unknown error"}
        </div>
      )}

      <MonthNavigator basePath="/fuel" yearMonth={yearMonth} />

      {/* Summary strip */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-x-8 gap-y-1.5 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="text-base font-bold tabular-nums text-slate-900">{vehiclesLogged}</span>
            <span className="text-slate-500">vehicles with entries</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-base font-bold tabular-nums text-slate-900">
              {grandLitres > 0 ? `${grandLitres} L` : "—"}
            </span>
            <span className="text-slate-500">total fuel</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-base font-bold tabular-nums text-slate-900">
              {grandAmount > 0 ? `₹${grandAmount.toLocaleString("en-IN")}` : "—"}
            </span>
            <span className="text-slate-500">total cost</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-base font-bold tabular-nums text-slate-900">
              {grandKm > 0 ? `${grandKm.toLocaleString("en-IN")} km` : "—"}
            </span>
            <span className="text-slate-500">distance (GPS)</span>
          </span>
        </div>
      </div>

      {/* Vehicle table */}
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
            <Droplets className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No vehicles in your scope</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3">Ownership</th>
                    <th className="px-5 py-3 text-right">Entries</th>
                    <th className="px-5 py-3 text-right">Fuel (L)</th>
                    <th className="px-5 py-3 text-right">Cost (₹)</th>
                    <th className="px-5 py-3 text-right">KM (GPS)</th>
                    <th className="px-5 py-3 text-right">Avg km/L</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ vehicle, logs, totalLitres, totalAmount, gpsKm, avg, canManage }) => {
                    const isCompany = vehicle.fuel_ownership === "company";
                    return (
                      <tr key={vehicle.vehicle_id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/vehicles/${vehicle.vehicle_id}?tab=Fuel+Logs`}
                            className="font-semibold text-slate-900 hover:underline"
                          >
                            {vehicle.registration_no}
                          </Link>
                          <p className="text-xs text-slate-400">{vehicle.vehicle_type ?? "—"}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          <span className="block">{vehicle.division ?? "Unassigned"}</span>
                          <span className="text-xs text-slate-400">{vehicle.substation ?? "—"}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={isCompany ? "blue" : "yellow"}>
                            {isCompany ? "Company" : "Vendor"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {isCompany ? (
                            <span className={logs.length > 0 ? "font-semibold text-slate-900" : "text-slate-400"}>
                              {logs.length}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {isCompany && totalLitres > 0 ? (
                            <span className="font-medium text-slate-900">{totalLitres}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {isCompany && totalAmount > 0 ? (
                            <span className="font-medium text-slate-900">
                              {totalAmount.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-600">
                          {isCompany && gpsKm > 0 ? (
                            gpsKm.toLocaleString("en-IN")
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {avg !== null ? (
                            <Badge tone="green">{avg}</Badge>
                          ) : isCompany && logs.length > 0 ? (
                            <span className="text-xs text-slate-400">need GPS sync</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
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
