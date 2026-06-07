import { notFound } from "next/navigation";
import { Edit3, RefreshCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VehicleProfileTabs } from "@/components/vehicles/VehicleProfileTabs";
import {
  addFuelLogAction,
  changeFuelOwnershipAction,
  changeVehicleStatusAction,
  replaceDriverAssignmentAction,
} from "@/lib/actions/vehicle-actions";
import { requireProfile } from "@/lib/auth";
import {
  getDriverAssignments,
  getDrivers,
  getFuelLogs,
  getFuelOwnershipHistory,
  getLookups,
  getStatusHistory,
  getVehicle,
  getVehicleTransfers,
} from "@/lib/data";
import { canEditVehicle, canInitiateTransfer } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_TABS = [
  "Overview",
  "Drivers",
  "Fuel Logs",
  "Transfers",
  "Status History",
  "Fuel History",
  "Driver History",
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
  const profile = await requireProfile();
  const vehicle = await getVehicle(params.id, profile);
  if (!vehicle) notFound();

  const [drivers, transfers, statusHistory, fuelLogs, fuelOwnershipHistory, availableDrivers, lookups] =
    await Promise.all([
      getDriverAssignments(vehicle.vehicle_id, profile),
      getVehicleTransfers(vehicle.vehicle_id, profile),
      getStatusHistory(vehicle.vehicle_id, profile),
      getFuelLogs(vehicle.vehicle_id, profile),
      getFuelOwnershipHistory(vehicle.vehicle_id, profile),
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
        eyebrow={`${vehicle.current_circle ?? vehicle.home_circle} / ${vehicle.division ?? "Unassigned"} / ${vehicle.substation ?? "Unassigned"}`}
        backHref="/vehicles"
      >
        <StatusBadge status={vehicle.status} />
        {canManageVehicle ? (
          <LinkButton href={`/vehicles/${vehicle.vehicle_id}/edit`} variant="outline">
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            Update Vehicle
          </LinkButton>
        ) : null}
        {canTransfer ? (
          <LinkButton href={`/vehicles/${vehicle.vehicle_id}/transfer`}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Change Location
          </LinkButton>
        ) : null}
      </PageHeader>
      <VehicleProfileTabs
        vehicle={vehicle}
        drivers={drivers}
        transfers={transfers}
        statusHistory={statusHistory}
        fuelLogs={fuelLogs}
        fuelOwnershipHistory={fuelOwnershipHistory}
        availableDrivers={availableDrivers}
        canManage={canManageVehicle}
        defaultTab={defaultTab}
        changeStatusAction={changeVehicleStatusAction}
        changeFuelOwnershipAction={changeFuelOwnershipAction}
        replaceDriverAction={replaceDriverAssignmentAction}
        addFuelLogAction={addFuelLogAction}
      />
    </AppShell>
  );
}
