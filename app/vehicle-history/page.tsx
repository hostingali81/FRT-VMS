import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { VehicleHistoryRegister } from "@/components/vehicle-history/VehicleHistoryRegister";
import { requireProfile } from "@/lib/auth";
import { getVehicleHistory, preloadFleetData, preloadHistoryData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function VehicleHistoryPage() {
  // Start the data queries while the auth round trips are still in flight.
  preloadFleetData();
  preloadHistoryData();
  const profile = await requireProfile();
  const history = await getVehicleHistory(profile);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Vehicle History" eyebrow="Simple vehicle register" />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <VehicleHistoryRegister history={history} />
      </div>
    </AppShell>
  );
}
