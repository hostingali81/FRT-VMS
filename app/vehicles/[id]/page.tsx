import { notFound } from "next/navigation";
import { Edit3, RefreshCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VehicleProfileTabs } from "@/components/vehicles/VehicleProfileTabs";
import { changeVehicleStatusAction, replaceDriverAssignmentAction } from "@/lib/actions/vehicle-actions";
import { requireProfile } from "@/lib/auth";
import { getDriverAssignments, getDrivers, getLookups, getStatusHistory, getVehicle, getVehicleTransfers } from "@/lib/data";
import { canEditVehicle, canInitiateTransfer } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function VehicleProfilePage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  const vehicle = await getVehicle(params.id, profile);
  if (!vehicle) notFound();

  const [drivers, transfers, statusHistory, availableDrivers, lookups] = await Promise.all([
    getDriverAssignments(vehicle.vehicle_id, profile),
    getVehicleTransfers(vehicle.vehicle_id, profile),
    getStatusHistory(vehicle.vehicle_id, profile),
    getDrivers(profile),
    getLookups(profile),
  ]);
  const canManageVehicle = canEditVehicle(profile, vehicle, lookups);
  const canTransfer = canInitiateTransfer(profile, vehicle, lookups);

  return (
    <AppShell profile={profile}>
      <PageHeader title={vehicle.registration_no} eyebrow={`${vehicle.current_circle ?? vehicle.home_circle} / ${vehicle.division ?? "Unassigned"} / ${vehicle.substation ?? "Unassigned"}`}>
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
            Transfer
          </LinkButton>
        ) : null}
      </PageHeader>
      <VehicleProfileTabs
        vehicle={vehicle}
        drivers={drivers}
        transfers={transfers}
        statusHistory={statusHistory}
        availableDrivers={availableDrivers}
        canManage={canManageVehicle}
        canTransfer={canTransfer}
        changeStatusAction={changeVehicleStatusAction}
        replaceDriverAction={replaceDriverAssignmentAction}
      />
    </AppShell>
  );
}
