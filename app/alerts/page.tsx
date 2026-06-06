import Link from "next/link";
import { AlertTriangle, CarFront, IdCard } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpiryBadge } from "@/components/shared/ExpiryBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { requireProfile } from "@/lib/auth";
import { getAlertsData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const profile = await requireProfile();
  const { documentAlerts, driverLicenseAlerts, vehiclesWithoutAllDrivers } = await getAlertsData(profile);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Alerts" eyebrow="Expiry and staffing monitor" />
      <div className="grid gap-4 px-4 py-5 sm:px-6 lg:px-8 xl:grid-cols-3">
        <AlertCard icon={<AlertTriangle />} title="Vehicle Documents" count={documentAlerts.length}>
          <div className="space-y-3">
            {documentAlerts.map((vehicle) => (
              <div key={vehicle.vehicle_id} className="rounded-md border border-slate-200 p-3">
                <Link href={`/vehicles/${vehicle.vehicle_id}`} className="font-semibold text-slate-950 hover:underline">
                  {vehicle.registration_no}
                </Link>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ExpiryBadge label="Insurance" date={vehicle.insurance_expiry} />
                  <ExpiryBadge label="Fitness" date={vehicle.fitness_expiry} />
                  <ExpiryBadge label="Pollution" date={vehicle.pollution_expiry} />
                </div>
              </div>
            ))}
          </div>
        </AlertCard>
        <AlertCard icon={<IdCard />} title="Driver Licenses" count={driverLicenseAlerts.length}>
          <div className="space-y-3">
            {driverLicenseAlerts.map((driver) => (
              <div key={driver.driver_id} className="rounded-md border border-slate-200 p-3">
                <p className="font-semibold text-slate-950">{driver.name}</p>
                <p className="break-words text-sm text-slate-500">{driver.circle} / {driver.mobile ?? "No mobile"}</p>
                <div className="mt-2">
                  <ExpiryBadge date={driver.license_expiry} />
                </div>
              </div>
            ))}
          </div>
        </AlertCard>
        <AlertCard icon={<CarFront />} title="Driver Coverage" count={vehiclesWithoutAllDrivers.length}>
          <div className="space-y-3">
            {vehiclesWithoutAllDrivers.map((vehicle) => (
              <div key={vehicle.vehicle_id} className="rounded-md border border-slate-200 p-3">
                <Link href={`/vehicles/${vehicle.vehicle_id}`} className="font-semibold text-slate-950 hover:underline">
                  {vehicle.registration_no}
                </Link>
                <p className="mt-1 break-words text-sm text-slate-500">{vehicle.division ?? "Unassigned"} / {vehicle.substation ?? "Unassigned"}</p>
                <Badge tone="yellow" className="mt-2">One or more shifts empty</Badge>
              </div>
            ))}
          </div>
        </AlertCard>
      </div>
    </AppShell>
  );
}

function AlertCard({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <Badge tone={count > 0 ? "red" : "green"}>{count} open</Badge>
        <div className="mt-4">{children}</div>
      </CardContent>
    </Card>
  );
}
