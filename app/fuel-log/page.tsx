import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { MonthNavigator } from "@/components/fuel/MonthNavigator";
import { requireProfile } from "@/lib/auth";
import { getFuelLogsForMonth, getVehicles } from "@/lib/data";
import { formatDate } from "@/lib/utils/format";
import { currentYearMonth, isValidYearMonth } from "@/lib/utils/month";

export const dynamic = "force-dynamic";

export default async function FuelLogPage({ searchParams }: { searchParams: { m?: string } }) {
  const profile = await requireProfile();

  const yearMonth = isValidYearMonth(searchParams.m) ? searchParams.m : currentYearMonth();

  const [fuelLogs, vehicles] = await Promise.all([
    getFuelLogsForMonth(profile, yearMonth),
    getVehicles(profile),
  ]);

  const vehicleById = new Map(vehicles.map((v) => [v.vehicle_id, v]));

  // Newest entry first
  const entries = [...fuelLogs].sort((a, b) => {
    if (a.log_date !== b.log_date) return b.log_date.localeCompare(a.log_date);
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });

  return (
    <AppShell profile={profile}>
      <PageHeader title="Fuel Log" eyebrow="Every fuel entry, newest first" />

      <MonthNavigator basePath="/fuel-log" yearMonth={yearMonth} />

      {/* Count strip */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:px-6 lg:px-8">
        <span className="flex items-center gap-1.5">
          <span className="text-base font-bold tabular-nums text-slate-900">{entries.length}</span>
          <span className="text-slate-500">{entries.length === 1 ? "entry" : "entries"} this month</span>
        </span>
      </div>

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
            <ClipboardList className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Is month koi fuel entry nahi</p>
            <p className="mt-1 text-xs text-slate-400">
              Entry kisi vehicle ke profile ke Fuel Logs tab se add hoti hai.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3 text-right">Litres</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-right">KM (GPS)</th>
                    <th className="px-5 py-3 text-right">Avg km/L</th>
                    <th className="px-5 py-3">Notes</th>
                    <th className="px-5 py-3">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((log) => {
                    const vehicle = vehicleById.get(log.vehicle_id);
                    const avg =
                      log.gps_distance_km !== null && log.fuel_litres > 0
                        ? +(log.gps_distance_km / log.fuel_litres).toFixed(1)
                        : null;
                    return (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-medium text-slate-900">{formatDate(log.log_date)}</td>
                        <td className="px-5 py-3.5">
                          {vehicle ? (
                            <Link
                              href={`/vehicles/${vehicle.vehicle_id}?tab=Fuel+Logs`}
                              className="font-semibold text-slate-900 hover:underline"
                            >
                              {vehicle.registration_no}
                            </Link>
                          ) : (
                            <span className="text-slate-400">Unknown</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {vehicle ? (
                            <>
                              <span className="block">{vehicle.division ?? "Unassigned"}</span>
                              <span className="text-xs text-slate-400">{vehicle.substation ?? "—"}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium text-slate-900">{log.fuel_litres} L</td>
                        <td className="px-5 py-3.5 text-right text-slate-700">
                          {log.fuel_amount != null ? `₹${log.fuel_amount.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-600">
                          {log.gps_distance_km != null ? (
                            `${log.gps_distance_km.toLocaleString("en-IN")} km`
                          ) : (
                            <span className="text-xs text-slate-400">{log.gps_synced_at ? "no GPS" : "not synced"}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {avg !== null ? <Badge tone="blue">{avg}</Badge> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">{log.notes ?? "—"}</td>
                        <td className="px-5 py-3.5 text-slate-500">{log.recorded_by ?? "—"}</td>
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
