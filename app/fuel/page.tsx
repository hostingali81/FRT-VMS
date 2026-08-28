import { Fuel, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LinkButton } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { DismissibleBanner } from "@/components/ui/dismissible-banner";
import { PageHeader } from "@/components/shared/PageHeader";
import { MonthNavigator } from "@/components/fuel/MonthNavigator";
import { FuelDashboardTable, type FuelDashboardRow } from "@/components/fuel/FuelDashboardTable";
import { requireProfile } from "@/lib/auth";
import {
  getAllFuelLogs,
  getAllLookups,
  getFuelLogsForMonth,
  getGpsDistanceForMonth,
  getVehicles,
  preloadFleetData,
  preloadFuelMonthData,
} from "@/lib/data";
import { canCreateVehicle, canEditVehicle } from "@/lib/permissions";
import { computeMileageByFuel, type MileageBreakdown } from "@/lib/mileage";
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

  const [vehicles, fuelLogs, allFuelLogs, gpsDistance, lookups] = await Promise.all([
    getVehicles(profile),
    getFuelLogsForMonth(profile, yearMonth),
    getAllFuelLogs(profile),
    getGpsDistanceForMonth(yearMonth),
    getAllLookups(),
  ]);

  // Only vehicles that are actually on the road — maintenance/breakdown/standby/
  // accident/removed are left out of the dashboard and its month totals.
  const activeVehicles = vehicles.filter((v) => v.status === "active");

  const logsByVehicle = new Map<string, typeof fuelLogs>();
  for (const log of fuelLogs) {
    if (!logsByVehicle.has(log.vehicle_id)) logsByVehicle.set(log.vehicle_id, []);
    logsByVehicle.get(log.vehicle_id)!.push(log);
  }

  // All logs per vehicle → all-time mileage.
  const allLogsByVehicle = new Map<string, typeof allFuelLogs>();
  for (const log of allFuelLogs) {
    if (!allLogsByVehicle.has(log.vehicle_id)) allLogsByVehicle.set(log.vehicle_id, []);
    allLogsByVehicle.get(log.vehicle_id)!.push(log);
  }

  // Monthly GPS distance (set by "Sync GPS Data") for the selected month.
  const gpsKmByVehicle = new Map<string, number>();
  for (const row of gpsDistance) gpsKmByVehicle.set(row.vehicle_id, row.distance_km);

  const frtSortKey = (frt_no: string | null | undefined) => {
    const match = frt_no?.match(/\d+/);
    return match ? parseInt(match[0], 10) : Number.POSITIVE_INFINITY;
  };

  // Rows are fully computed here; the client component only filters, groups and
  // sums them, so the mileage maths stays on the server where the logs live.
  const rows: FuelDashboardRow[] = activeVehicles
    .map((v) => {
      const logs = logsByVehicle.get(v.vehicle_id) ?? [];
      // Round the float sum — adding decimals (e.g. 5.5 + 8.69) leaves artifacts like 14.190000000000001.
      const totalLitres = +logs.reduce((sum, l) => sum + (l.fuel_litres ?? 0), 0).toFixed(2);
      const totalAmount = logs.reduce((sum, l) => sum + (l.fuel_amount ?? 0), 0);
      // Mileage uses the tankful method (GPS first→last fill ÷ fuel minus the latest
      // fill), not the raw monthly GPS ÷ litres — and per fuel type, so a bi-fuel
      // vehicle's CNG and petrol stay separate.
      const monthlyMileage = computeMileageByFuel(logs);
      const allTimeMileage = computeMileageByFuel(allLogsByVehicle.get(v.vehicle_id) ?? []);
      // Dominant fuel (most litres burned) for the roll-ups, so a bi-fuel vehicle
      // contributes its distance once instead of once per fuel type.
      const primary = monthlyMileage.reduce<MileageBreakdown | null>(
        (best, m) => (best && best.litres >= m.breakdown.litres ? best : m.breakdown),
        null,
      );
      return {
        vehicleId: v.vehicle_id,
        registrationNo: v.registration_no,
        frtNo: v.frt_no,
        vendorName: v.vendor_name,
        circleId: v.current_circle_id,
        circle: v.current_circle,
        divisionId: v.division_id,
        division: v.division,
        substationId: v.substation_id,
        substation: v.substation,
        isCompany: v.fuel_ownership === "company",
        entries: logs.length,
        totalLitres,
        totalAmount,
        gpsKm: gpsKmByVehicle.get(v.vehicle_id) ?? 0,
        hasGps: Boolean(v.gps_device_id),
        canManage: canEditVehicle(profile, v, lookups),
        monthlyMileage,
        allTimeMileage,
        primaryMonthly: primary ? { distanceKm: primary.distanceKm, litres: primary.litres } : null,
      };
    })
    .sort((a, b) => frtSortKey(a.frtNo) - frtSortKey(b.frtNo));

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
      <PageHeader title="Fuel Dashboard" eyebrow="Monthly fuel summary — active vehicles only">
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

      <FuelDashboardTable
        rows={rows}
        yearMonth={yearMonth}
        syncSlot={
          canSyncGps ? (
            <form action={syncGpsMonthlyDistanceAction} className="flex items-center sm:hidden">
              <SubmitButton variant="outline" className="h-9 w-full gap-1.5 px-2 text-xs">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Sync GPS
              </SubmitButton>
            </form>
          ) : null
        }
      />
    </AppShell>
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
