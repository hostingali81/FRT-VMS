import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { TransferForm } from "@/components/vehicles/TransferForm";
import { transferVehicleAction } from "@/lib/actions/vehicle-actions";
import { requireProfile } from "@/lib/auth";
import { getDriverAssignments, getLookups, getVehicle, preloadFleetData } from "@/lib/data";
import { canInitiateTransfer } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function TransferVehiclePage({ params }: { params: { id: string } }) {
  // Start the fleet queries while the auth round trips are still in flight.
  preloadFleetData();
  const profile = await requireProfile();
  const [vehicle, lookups] = await Promise.all([getVehicle(params.id, profile), getLookups(profile)]);
  if (!vehicle) notFound();
  if (!canInitiateTransfer(profile, vehicle, lookups)) redirect(`/vehicles/${vehicle.vehicle_id}?error=permission`);

  // The vehicle's current drivers — shown so the user can decide whether they
  // should move with the vehicle or stay posted at the current substation.
  const driverAssignments = await getDriverAssignments(vehicle.vehicle_id, profile);
  const currentDrivers = driverAssignments.filter((assignment) => !assignment.to_date);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Change Location" eyebrow={vehicle.registration_no} backHref={`/vehicles/${vehicle.vehicle_id}`} />
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <TransferForm
          vehicle={vehicle}
          lookups={lookups}
          currentDrivers={currentDrivers}
          action={transferVehicleAction}
          cancelHref={`/vehicles/${vehicle.vehicle_id}`}
        />
      </div>
    </AppShell>
  );
}
