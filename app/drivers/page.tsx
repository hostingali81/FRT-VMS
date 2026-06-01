import { AppShell } from "@/components/layout/AppShell";
import { DriverForm } from "@/components/drivers/DriverForm";
import { DriverTable } from "@/components/drivers/DriverTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { createDriverAction } from "@/lib/actions/vehicle-actions";
import { requireProfile } from "@/lib/auth";
import { getDrivers, getLookups } from "@/lib/data";
import { canManageDrivers } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function DriversPage() {
  const profile = await requireProfile();
  const [drivers, lookups] = await Promise.all([getDrivers(profile), getLookups(profile)]);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Drivers" eyebrow="Driver master and shift assignment" />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        {canManageDrivers(profile) ? <DriverForm lookups={lookups} action={createDriverAction} /> : null}
        <DriverTable drivers={drivers} />
      </div>
    </AppShell>
  );
}
