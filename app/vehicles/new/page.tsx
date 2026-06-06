import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { createVehicleAction } from "@/lib/actions/vehicle-actions";
import { requireProfile } from "@/lib/auth";
import { getLookups } from "@/lib/data";
import { canCreateVehicle } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  const profile = await requireProfile();
  if (!canCreateVehicle(profile)) redirect("/vehicles?error=permission");
  const lookups = await getLookups(profile);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Add Vehicle" eyebrow="Vehicle master" backHref="/vehicles" />
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <VehicleForm lookups={lookups} action={createVehicleAction} cancelHref="/vehicles" />
      </div>
    </AppShell>
  );
}
