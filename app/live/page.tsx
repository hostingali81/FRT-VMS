import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { LiveTracking } from "@/components/live/LiveTracking";
import { getFleetLiveStatusAction } from "@/lib/actions/live-actions";
import { requireProfile } from "@/lib/auth";
import { preloadFleetData } from "@/lib/data";
import { getFleetLiveStatus } from "@/lib/live-tracking";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  // Start the fleet query while the auth round trips are still in flight.
  preloadFleetData();
  const profile = await requireProfile();
  const initial = await getFleetLiveStatus(profile);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Live Tracking" eyebrow="Real-time fleet status" />
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <LiveTracking initial={initial} action={getFleetLiveStatusAction} />
      </div>
    </AppShell>
  );
}
