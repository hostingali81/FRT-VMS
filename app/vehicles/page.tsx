import { Plus, Tag } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleTable } from "@/components/vehicles/VehicleTable";
import { requireProfile } from "@/lib/auth";
import { getLookups, getVehicles, preloadFleetData } from "@/lib/data";
import { canCreateVehicle, canEditVehicle, canInitiateTransfer } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  // Start the fleet queries while the auth round trips are still in flight.
  preloadFleetData();
  const profile = await requireProfile();
  const [vehicles, lookups] = await Promise.all([getVehicles(profile), getLookups(profile)]);
  const editableVehicleIds = vehicles.filter((vehicle) => canEditVehicle(profile, vehicle, lookups)).map((vehicle) => vehicle.vehicle_id);
  const transferableVehicleIds = vehicles
    .filter((vehicle) => canInitiateTransfer(profile, vehicle, lookups))
    .map((vehicle) => vehicle.vehicle_id);
  const canExport = profile.role === "super_admin" || profile.role === "zonal_manager";

  return (
    <AppShell profile={profile}>
      <PageHeader title="Vehicles" eyebrow="Vehicle master and deployment">
        {profile.role === "super_admin" ? (
          <LinkButton href="/vehicles/gps-names" variant="secondary">
            <Tag className="h-4 w-4" aria-hidden="true" />
            GPS Names
          </LinkButton>
        ) : null}
        {canCreateVehicle(profile) ? (
          <LinkButton href="/vehicles/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Vehicle
          </LinkButton>
        ) : null}
      </PageHeader>
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <VehicleTable
          vehicles={vehicles}
          lookups={lookups}
          canExport={canExport}
          editableVehicleIds={editableVehicleIds}
          transferableVehicleIds={transferableVehicleIds}
        />
      </div>
    </AppShell>
  );
}
