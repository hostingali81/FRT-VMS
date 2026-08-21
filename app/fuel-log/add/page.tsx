import Link from "next/link";
import { CheckCircle2, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { QuickFuelForm } from "@/components/fuel/QuickFuelForm";
import { FuelLogEditTable, type FuelLogRow } from "@/components/fuel/FuelLogEditTable";
import { addFuelLogAction, deleteFuelLogAction, updateFuelLogAction } from "@/lib/actions/vehicle-actions";
import { requireProfile } from "@/lib/auth";
import { getAllFuelLogs, getAllLookups, getVehicles, preloadFleetData } from "@/lib/data";
import { canEditVehicle } from "@/lib/permissions";
import { istToday } from "@/lib/utils/month";

export const dynamic = "force-dynamic";

/** How many of the most recent entries the correction table shows. */
const RECENT_LIMIT = 25;

export default async function AddFuelEntryPage({
  searchParams,
}: {
  searchParams: { added?: string; updated?: string; deleted?: string; resync?: string; error?: string; page?: string };
}) {
  // Start the fleet queries while the auth round trips are still in flight.
  preloadFleetData();
  const profile = await requireProfile();
  const [vehicles, lookups, allFuelLogs] = await Promise.all([
    getVehicles(profile),
    getAllLookups(),
    getAllFuelLogs(profile),
  ]);

  // Company-fuel vehicles the user can edit — the pool both the form and the
  // correction table draw from.
  const manageable = vehicles.filter(
    (v) => v.fuel_ownership === "company" && canEditVehicle(profile, v, lookups),
  );
  const manageableById = new Map(manageable.map((v) => [v.vehicle_id, v]));

  const toOption = (v: (typeof manageable)[number]) => ({
    vehicle_id: v.vehicle_id,
    registration_no: v.registration_no,
    frt_no: v.frt_no,
    substation: v.substation,
    division: v.division,
    fuel_type: v.fuel_type,
  });

  // New entries can only be logged against a vehicle that is currently active.
  const options = manageable
    .filter((v) => v.status === "active")
    .sort((a, b) => a.registration_no.localeCompare(b.registration_no))
    .map(toOption);

  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const offset = (page - 1) * RECENT_LIMIT;

  // Newest first — same tie-break as the Fuel Log page (date, then insert order).
  const sortedFilteredLogs = allFuelLogs
    .filter((log) => manageableById.has(log.vehicle_id))
    .sort((a, b) => {
      if (a.log_date !== b.log_date) return b.log_date.localeCompare(a.log_date);
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
    
  const totalPages = Math.ceil(sortedFilteredLogs.length / RECENT_LIMIT);
  const recentLogs = sortedFilteredLogs.slice(offset, offset + RECENT_LIMIT);

  const recentEntries: FuelLogRow[] = recentLogs.map((log) => {
    const vehicle = manageableById.get(log.vehicle_id)!;
    return {
      id: log.id,
      vehicle_id: log.vehicle_id,
      log_date: log.log_date,
      logged_at: log.logged_at ?? null,
      fuel_type: log.fuel_type,
      fuel_litres: log.fuel_litres,
      fuel_amount: log.fuel_amount,
      notes: log.notes,
      registration_no: vehicle.registration_no,
      frt_no: vehicle.frt_no,
      substation: vehicle.substation,
      recorded_by: log.recorded_by,
    };
  });

  // An older entry may belong to a vehicle that is no longer active. Keep those
  // vehicles selectable while editing so a correction doesn't force a reassignment.
  const optionIds = new Set(options.map((o) => o.vehicle_id));
  const editOptions = [
    ...options,
    ...recentLogs
      .filter((log) => !optionIds.has(log.vehicle_id))
      .map((log) => manageableById.get(log.vehicle_id)!)
      .filter((v, i, arr) => arr.findIndex((x) => x.vehicle_id === v.vehicle_id) === i)
      .map(toOption),
  ];

  const today = istToday();

  // Every mutation redirects back to this same route, and the App Router keeps
  // client state across a same-route navigation — the add form would hold the
  // values just saved and the edit card would stay open on the row just updated.
  // Keying both on the saved data remounts them whenever a row actually changed.
  const dataKey = recentEntries
    .map((e) => `${e.id}:${e.log_date}:${e.logged_at ?? ""}:${e.fuel_type ?? ""}:${e.fuel_litres}:${e.fuel_amount ?? ""}`)
    .join("|");

  return (
    <AppShell profile={profile}>
      <PageHeader title="Add Fuel Entry" eyebrow="Quick fuel log" backHref="/fuel-log" />

      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 lg:px-8">
        {searchParams.added && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            {searchParams.added} ki fuel entry save ho gayi. Agli entry daal sakte ho.
          </div>
        )}
        {searchParams.updated && (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              {searchParams.updated} ki entry update ho gayi.
            </span>
            {searchParams.resync && (
              <span className="mt-1 block text-xs text-emerald-700">
                Date, time ya vehicle badla hai — KM aur average ke liye Fuel Dashboard par{" "}
                <span className="font-semibold">Sync GPS Data</span> chalayein.
              </span>
            )}
          </div>
        )}
        {searchParams.deleted && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
            <Trash2 className="h-4 w-4" />
            {searchParams.deleted} ki entry delete kar di gayi.
          </div>
        )}
        {searchParams.error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
            {searchParams.error}
          </div>
        )}

        {options.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm font-medium text-slate-600">Koi active company-fuel vehicle nahi mila</p>
              <p className="mt-1 text-xs text-slate-400">
                Fuel entry sirf active company-fuel vehicles ke liye hoti hai.{" "}
                <Link href="/fuel" className="text-slate-700 underline">
                  Fuel Dashboard
                </Link>{" "}
                dekho.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <QuickFuelForm key={dataKey} vehicles={options} action={addFuelLogAction} today={today} />
            </CardContent>
          </Card>
        )}

        {/* Recent entries with pencil/bin — fix a wrong amount, date or vehicle here.
            Hidden entirely for a user with no company-fuel vehicle to correct. */}
        {manageable.length > 0 && (
          <div className="mt-6">
            <FuelLogEditTable
              key={dataKey}
              entries={recentEntries}
              vehicles={editOptions}
              updateAction={updateFuelLogAction}
              deleteAction={deleteFuelLogAction}
              today={today}
              page={page}
              totalPages={totalPages}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
