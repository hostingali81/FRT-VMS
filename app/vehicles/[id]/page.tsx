import { notFound } from "next/navigation";
import { Edit3, RefreshCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VehicleProfileTabs } from "@/components/vehicles/VehicleProfileTabs";
import {
  addFuelLogAction,
  changeDriverOwnershipAction,
  changeFuelOwnershipAction,
  changeVehicleStatusAction,
  replaceDriverAssignmentAction,
} from "@/lib/actions/vehicle-actions";
import { requireProfile } from "@/lib/auth";
import {
  getDriverAssignments,
  getDriverOwnershipHistory,
  getDrivers,
  getFuelLogs,
  getFuelOwnershipHistory,
  getGpsDistanceHistory,
  getLookups,
  getStatusHistory,
  getVehicle,
  getVehicleTransfers,
  preloadDriverData,
  preloadFleetData,
  preloadHistoryData,
} from "@/lib/data";
import { canEditVehicle, canInitiateTransfer } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_TABS = [
  "Overview",
  "Drivers",
  "Fuel Logs",
  "GPS Distance",
  "Transfers",
  "Status History",
  "Fuel History",
  "Driver History",
  "Driver Source",
  "Documents",
] as const;

type ValidTab = (typeof VALID_TABS)[number];

function parseTab(raw: string | undefined): ValidTab | undefined {
  if (!raw) return undefined;
  const decoded = decodeURIComponent(raw);
  return VALID_TABS.includes(decoded as ValidTab) ? (decoded as ValidTab) : undefined;
}

export default async function VehicleProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  // Start the data queries while the auth round trips are still in flight.
  preloadFleetData();
  preloadDriverData();
  preloadHistoryData();
  const profile = await requireProfile();
  const vehicle = await getVehicle(params.id, profile);
  if (!vehicle) notFound();

  const [drivers, transfers, statusHistory, fuelLogs, gpsDistance, fuelOwnershipHistory, driverOwnershipHistory, availableDrivers, lookups] =
    await Promise.all([
      getDriverAssignments(vehicle.vehicle_id, profile),
      getVehicleTransfers(vehicle.vehicle_id, profile),
      getStatusHistory(vehicle.vehicle_id, profile),
      getFuelLogs(vehicle.vehicle_id, profile),
      getGpsDistanceHistory(vehicle.vehicle_id, profile),
      getFuelOwnershipHistory(vehicle.vehicle_id, profile),
      getDriverOwnershipHistory(vehicle.vehicle_id, profile),
      getDrivers(profile),
      getLookups(profile),
    ]);

  const canManageVehicle = canEditVehicle(profile, vehicle, lookups);
  const canTransfer = canInitiateTransfer(profile, vehicle, lookups);
  const defaultTab = parseTab(searchParams.tab);

  return (
    <AppShell profile={profile}>
      <PageHeader
        title={vehicle.registration_no}
        eyebrow={`${vehicle.frt_no ? `${vehicle.frt_no} · ` : ""}${vehicle.current_circle ?? vehicle.home_circle} / ${vehicle.division ?? "Unassigned"} / ${vehicle.substation ?? "Unassigned"}`}
        backHref="/vehicles"
        badge={<StatusBadge status={vehicle.status} />}
      >
        {/* Both actions share one row so they don't stack into two tall full-width
            buttons on mobile. flex-1 → equal halves when both show, full width when
            only one. Smaller text on mobile keeps "Change Location" on one line. */}
        {canManageVehicle || canTransfer ? (
          <div className="flex w-full gap-2 sm:w-auto">
            {canManageVehicle ? (
              <LinkButton
                href={`/vehicles/${vehicle.vehicle_id}/edit`}
                variant="outline"
                className="flex-1 justify-center whitespace-nowrap px-3 text-xs sm:flex-none sm:px-4 sm:text-sm"
              >
                <Edit3 className="h-4 w-4" aria-hidden="true" />
                Update Vehicle
              </LinkButton>
            ) : null}
            {canTransfer ? (
              <LinkButton
                href={`/vehicles/${vehicle.vehicle_id}/transfer`}
                className="flex-1 justify-center whitespace-nowrap px-3 text-xs sm:flex-none sm:px-4 sm:text-sm"
              >
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                Change Location
              </LinkButton>
            ) : null}
          </div>
        ) : null}
      </PageHeader>
      <VehicleProfileTabs
        vehicle={vehicle}
        drivers={drivers}
        transfers={transfers}
        statusHistory={statusHistory}
        fuelLogs={fuelLogs}
        gpsDistance={gpsDistance}
        fuelOwnershipHistory={fuelOwnershipHistory}
        driverOwnershipHistory={driverOwnershipHistory}
        availableDrivers={availableDrivers}
        canManage={canManageVehicle}
        defaultTab={defaultTab}
        changeStatusAction={changeVehicleStatusAction}
        changeFuelOwnershipAction={changeFuelOwnershipAction}
        changeDriverOwnershipAction={changeDriverOwnershipAction}
        replaceDriverAction={replaceDriverAssignmentAction}
        addFuelLogAction={addFuelLogAction}
      />
    </AppShell>
  );
}
