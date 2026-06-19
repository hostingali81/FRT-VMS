import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleTracker } from "@/components/live/VehicleTracker";
import { getVehicleLiveStatusAction } from "@/lib/actions/live-actions";
import { getVehicleRouteAction } from "@/lib/actions/route-actions";
import { requireProfile } from "@/lib/auth";
import { getVehicleLiveStatus } from "@/lib/live-tracking";

export const dynamic = "force-dynamic";

export default async function VehicleRoutePage({ params }: { params: { vehicleId: string } }) {
  const profile = await requireProfile();
  // Land on the vehicle's current/last position first; route history is loaded
  // on demand from the tracker (Route History → date range).
  const initialLive = await getVehicleLiveStatus(profile, params.vehicleId);

  return (
    <AppShell profile={profile}>
      <PageHeader title={initialLive.vehicle.title} eyebrow="Live location" backHref="/live" />
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <VehicleTracker
          vehicleId={params.vehicleId}
          initialLive={initialLive}
          liveAction={getVehicleLiveStatusAction}
          routeAction={getVehicleRouteAction}
        />
      </div>
    </AppShell>
  );
}
