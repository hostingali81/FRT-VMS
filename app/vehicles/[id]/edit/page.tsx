import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { updateVehicleAction } from "@/lib/actions/vehicle-actions";
import { requireProfile } from "@/lib/auth";
import { getLookups, getVehicle } from "@/lib/data";
import { canEditVehicle } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function EditVehiclePage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  const [vehicle, lookups] = await Promise.all([getVehicle(params.id, profile), getLookups(profile)]);
  if (!vehicle) notFound();
  if (!canEditVehicle(profile, vehicle, lookups)) redirect(`/vehicles/${vehicle.vehicle_id}?error=permission`);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Edit Vehicle" eyebrow={vehicle.registration_no} backHref={`/vehicles/${vehicle.vehicle_id}`} />
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <VehicleForm lookups={lookups} vehicle={vehicle} action={updateVehicleAction} submitLabel="Update Vehicle" cancelHref={`/vehicles/${vehicle.vehicle_id}`} />
      </div>
    </AppShell>
  );
}

