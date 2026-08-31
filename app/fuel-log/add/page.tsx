import Link from "next/link";
import { CheckCircle2, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { QuickFuelForm } from "@/components/fuel/QuickFuelForm";
import { FuelLogEditTable, type FuelLogRow } from "@/components/fuel/FuelLogEditTable";
import {
  fuelLogFilterQuery,
  type FuelLogFilterOptions,
  type FuelLogFilterValues,
} from "@/components/fuel/FuelLogFilters";
import { addFuelLogAction, deleteFuelLogAction, updateFuelLogAction } from "@/lib/actions/vehicle-actions";
import { requireProfile } from "@/lib/auth";
import { getAllFuelLogs, getAllLookups, getVehicles, preloadFleetData } from "@/lib/data";
import { canEditVehicle } from "@/lib/permissions";
import { FUEL_LOG_TYPES } from "@/lib/types";
import { istToday } from "@/lib/utils/month";

export const dynamic = "force-dynamic";

/** How many of the most recent entries the correction table shows. */
const RECENT_LIMIT = 25;

/**
 * FNV-1a over the fields a correction can change. Same value in, same value out,
 * and it only moves when an entry is actually added, edited or deleted.
 */
function entriesSignature(
  logs: { id: string; log_date: string; logged_at?: string | null; fuel_type: string | null; fuel_litres: number; fuel_amount: number | null; notes: string | null }[],
) {
  let hash = 0x811c9dc5;
  for (const log of logs) {
    const row = `${log.id}:${log.log_date}:${log.logged_at ?? ""}:${log.fuel_type ?? ""}:${log.fuel_litres}:${log.fuel_amount ?? ""}:${log.notes ?? ""}`;
    for (let i = 0; i < row.length; i += 1) {
      hash ^= row.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return (hash >>> 0).toString(16);
}

export default async function AddFuelEntryPage({
  searchParams,
}: {
  searchParams: {
    added?: string;
    updated?: string;
    deleted?: string;
    resync?: string;
    error?: string;
    page?: string;
    // Recent Entries filters — see components/fuel/FuelLogFilters.tsx.
    q?: string;
    by?: string;
    div?: string;
    sub?: string;
    type?: string;
    from?: string;
    to?: string;
  };
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

  // Newest first — same tie-break as the Fuel Log page (date, then insert order).
  const visibleLogs = allFuelLogs
    .filter((log) => manageableById.has(log.vehicle_id))
    .sort((a, b) => {
      if (a.log_date !== b.log_date) return b.log_date.localeCompare(a.log_date);
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });

  // ── Recent Entries filters ────────────────────────────────────────────────
  // Applied here rather than in the client component: the table is paginated on
  // the server, so filtering after the slice would only ever search the 25 rows
  // on screen instead of every entry the user can see.
  const filters: FuelLogFilterValues = {
    q: (searchParams.q ?? "").trim(),
    by: (searchParams.by ?? "").trim(),
    div: (searchParams.div ?? "").trim(),
    sub: (searchParams.sub ?? "").trim(),
    type: (searchParams.type ?? "").trim(),
    from: (searchParams.from ?? "").trim(),
    to: (searchParams.to ?? "").trim(),
  };

  // Options come from the UNFILTERED visible set, so narrowing by one filter
  // never empties another's dropdown and strands the user.
  const loggedVehicles = Array.from(new Set(visibleLogs.map((log) => log.vehicle_id))).map(
    (id) => manageableById.get(id)!,
  );
  const uniqueBy = <T, K extends string>(rows: T[], key: (row: T) => K | null) => {
    const seen = new Map<K, T>();
    for (const row of rows) {
      const id = key(row);
      if (id && !seen.has(id)) seen.set(id, row);
    }
    return Array.from(seen.values());
  };
  const filterOptions: FuelLogFilterOptions = {
    people: Array.from(new Set(visibleLogs.map((log) => log.recorded_by).filter(Boolean) as string[])).sort((a, b) =>
      a.localeCompare(b),
    ),
    divisions: uniqueBy(loggedVehicles, (v) => v.division_id)
      .map((v) => ({ id: v.division_id as string, name: v.division ?? "Unassigned" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    substations: uniqueBy(loggedVehicles, (v) => v.substation_id)
      .map((v) => ({
        id: v.substation_id as string,
        name: v.substation ?? "Unassigned",
        divisionId: v.division_id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    // Keep the canonical Diesel/Petrol/CNG order rather than whatever the logs
    // happen to contain first.
    fuelTypes: FUEL_LOG_TYPES.filter((type) => visibleLogs.some((log) => log.fuel_type === type)),
  };

  // Registration/FRT search ignores case, spaces and punctuation, so "up41 ct6929"
  // and "frt3" both hit — the same normalisation the public fuel API uses.
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const queryTerm = norm(filters.q);
  const sortedFilteredLogs = visibleLogs.filter((log) => {
    const vehicle = manageableById.get(log.vehicle_id)!;
    if (queryTerm && !norm(vehicle.registration_no).includes(queryTerm) && !norm(vehicle.frt_no ?? "").includes(queryTerm)) {
      return false;
    }
    if (filters.by && log.recorded_by !== filters.by) return false;
    if (filters.div && vehicle.division_id !== filters.div) return false;
    if (filters.sub && vehicle.substation_id !== filters.sub) return false;
    if (filters.type && log.fuel_type !== filters.type) return false;
    if (filters.from && log.log_date < filters.from) return false;
    if (filters.to && log.log_date > filters.to) return false;
    return true;
  });

  const filterQuery = fuelLogFilterQuery(filters);
  const totalPages = Math.max(1, Math.ceil(sortedFilteredLogs.length / RECENT_LIMIT));
  // ?page= is user-editable, so clamp it to a real page. Math.max alone let a
  // non-numeric value through as NaN (Math.max(1, NaN) is NaN) and a too-large
  // number past the end — both rendered an empty table under a "page NaN of 3"
  // label instead of falling back to a page that exists.
  const requestedPage = parseInt(searchParams.page ?? "", 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), totalPages) : 1;
  const offset = (page - 1) * RECENT_LIMIT;

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
  //
  // Built from EVERY visible entry, not the current page: filtering and paging
  // change which rows are on screen without changing any of them, and keying on
  // the page would remount the add form mid-typing every time the user touched a
  // filter. A short hash keeps it out of the payload as the log grows.
  const dataKey = entriesSignature(visibleLogs);

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
              matchCount={sortedFilteredLogs.length}
              filters={filters}
              filterOptions={filterOptions}
              filterQuery={filterQuery}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
