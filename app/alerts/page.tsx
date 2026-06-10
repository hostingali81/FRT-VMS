import Link from "next/link";
import { AlertTriangle, CheckCircle2, IdCard, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { DismissibleBanner } from "@/components/ui/dismissible-banner";
import { ExpiryBadge } from "@/components/shared/ExpiryBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { requireProfile } from "@/lib/auth";
import { getAlertsData, preloadDriverData, preloadFleetData } from "@/lib/data";
import { canCreateVehicle } from "@/lib/permissions";
import { refreshRtoDocumentsAction } from "@/lib/actions/cars24-actions";
import { daysUntil, getWorstDocumentState } from "@/lib/utils/expiry";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";
// Allow up to 60s for the RTO refresh (one Cars24 call per editable vehicle, batched).
export const maxDuration = 60;

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: {
    rto?: string;
    rtoChecked?: string;
    rtoUpdated?: string;
    rtoUnchanged?: string;
    rtoNodata?: string;
    rtoFailed?: string;
    rtoReason?: string;
  };
}) {
  // Start the data queries while the auth round trips are still in flight.
  preloadFleetData();
  preloadDriverData();
  const profile = await requireProfile();
  const { documentAlerts, driverLicenseAlerts } = await getAlertsData(profile);

  const canRefresh = canCreateVehicle(profile);

  const rtoBanner = (() => {
    if (searchParams.rto === "ok") {
      const updatedCount = Number(searchParams.rtoUpdated) || 0;
      const failedCount = Number(searchParams.rtoFailed) || 0;
      const detail: string[] = [];
      if (Number(searchParams.rtoUnchanged) > 0) detail.push(`${searchParams.rtoUnchanged} already up to date`);
      if (Number(searchParams.rtoNodata) > 0) detail.push(`${searchParams.rtoNodata} no RTO record`);
      if (failedCount > 0) detail.push(`${failedCount} failed`);
      const suffix = detail.length ? ` (${detail.join(", ")})` : "";
      const failureReason = failedCount > 0 && searchParams.rtoReason ? ` Error: ${searchParams.rtoReason}` : "";
      // Nothing updated and at least one failure is a failed run — show it red.
      const isFailure = failedCount > 0 && updatedCount === 0;
      return {
        tone: isFailure ? ("error" as const) : ("success" as const),
        message: isFailure
          ? `RTO refresh failed — 0 of ${searchParams.rtoChecked ?? 0} vehicles updated${suffix}.${failureReason}`
          : `RTO refresh complete — ${updatedCount} of ${searchParams.rtoChecked ?? 0} vehicles updated${suffix}.${failureReason}`,
      };
    }
    if (searchParams.rto === "error") {
      return { tone: "error" as const, message: `RTO refresh failed: ${searchParams.rtoReason ?? "unknown error"}` };
    }
    return null;
  })();

  const sortedDocAlerts = [...documentAlerts].sort((a, b) => {
    const stateA = getWorstDocumentState([a.insurance_expiry, a.fitness_expiry, a.pollution_expiry]);
    const stateB = getWorstDocumentState([b.insurance_expiry, b.fitness_expiry, b.pollution_expiry]);
    if (stateA === "expired" && stateB !== "expired") return -1;
    if (stateB === "expired" && stateA !== "expired") return 1;
    const minA = Math.min(...[a.insurance_expiry, a.fitness_expiry, a.pollution_expiry].map((d) => daysUntil(d) ?? Infinity));
    const minB = Math.min(...[b.insurance_expiry, b.fitness_expiry, b.pollution_expiry].map((d) => daysUntil(d) ?? Infinity));
    return minA - minB;
  });

  const sortedLicenseAlerts = [...driverLicenseAlerts].sort(
    (a, b) => (daysUntil(a.license_expiry) ?? Infinity) - (daysUntil(b.license_expiry) ?? Infinity),
  );

  const expiredDocCount = sortedDocAlerts.filter(
    (v) => getWorstDocumentState([v.insurance_expiry, v.fitness_expiry, v.pollution_expiry]) === "expired",
  ).length;
  const expiredLicenseCount = sortedLicenseAlerts.filter((d) => (daysUntil(d.license_expiry) ?? 1) < 0).length;
  const totalExpired = expiredDocCount + expiredLicenseCount;
  const totalExpiring = (documentAlerts.length - expiredDocCount) + (driverLicenseAlerts.length - expiredLicenseCount);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Alerts" eyebrow="Expiry and staffing monitor">
        {canRefresh && (
          <form action={refreshRtoDocumentsAction}>
            <SubmitButton variant="outline">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh from RTO
            </SubmitButton>
          </form>
        )}
      </PageHeader>

      {/* RTO refresh result banner — auto-dismisses after a few seconds */}
      {rtoBanner && <DismissibleBanner tone={rtoBanner.tone} message={rtoBanner.message} />}

      <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        {/* Summary — two clear stat cards */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryStat value={totalExpired} label="Expired" urgent />
          <SummaryStat value={totalExpiring} label="Expiring soon" />
        </div>

        {/* Alert lists — single column on mobile, two across on wide screens */}
        <div className="grid gap-4 xl:grid-cols-2">
        <AlertCard icon={AlertTriangle} title="Vehicle Documents" count={documentAlerts.length} expiredCount={expiredDocCount}>
          {sortedDocAlerts.length === 0 ? (
            <ClearState message="All vehicle documents are in order" />
          ) : (
            <div className="space-y-2">
              {sortedDocAlerts.map((vehicle) => {
                const worstState = getWorstDocumentState([vehicle.insurance_expiry, vehicle.fitness_expiry, vehicle.pollution_expiry]);
                return (
                  <AlertRow key={vehicle.vehicle_id} severity={worstState as "expired" | "expiring"}>
                    <Link href={`/vehicles/${vehicle.vehicle_id}`} className="font-semibold text-slate-950 hover:underline">
                      {vehicle.registration_no}
                    </Link>
                    {(vehicle.current_circle || vehicle.division || vehicle.substation) && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {[vehicle.current_circle, vehicle.division, vehicle.substation].filter(Boolean).join(" › ")}
                      </p>
                    )}
                    {vehicle.vendor_name && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">Vendor: {vehicle.vendor_name}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <ExpiryBadge label="Insurance" date={vehicle.insurance_expiry} />
                      <ExpiryBadge label="Fitness" date={vehicle.fitness_expiry} />
                      <ExpiryBadge label="Pollution" date={vehicle.pollution_expiry} />
                    </div>
                  </AlertRow>
                );
              })}
            </div>
          )}
        </AlertCard>

        <AlertCard icon={IdCard} title="Driver Licenses" count={driverLicenseAlerts.length} expiredCount={expiredLicenseCount}>
          {sortedLicenseAlerts.length === 0 ? (
            <ClearState message="All driver licenses are valid" />
          ) : (
            <div className="space-y-2">
              {sortedLicenseAlerts.map((driver) => {
                const days = daysUntil(driver.license_expiry);
                const severity: "expired" | "expiring" = days !== null && days < 0 ? "expired" : "expiring";
                return (
                  <AlertRow key={driver.driver_id} severity={severity}>
                    <p className="font-semibold text-slate-950">{driver.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {driver.circle}
                      {driver.mobile ? ` · ${driver.mobile}` : ""}
                    </p>
                    <div className="mt-2">
                      <ExpiryBadge label="License" date={driver.license_expiry} />
                    </div>
                  </AlertRow>
                );
              })}
            </div>
          )}
        </AlertCard>

        </div>
      </div>
    </AppShell>
  );
}

function SummaryStat({ value, label, urgent }: { value: number; label: string; urgent?: boolean }) {
  const color = value === 0 ? "text-emerald-600" : urgent ? "text-red-600" : "text-amber-700";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-center">
      <p className={cn("text-xl font-bold tabular-nums sm:text-2xl", color)}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

function AlertCard({
  icon: Icon,
  title,
  count,
  expiredCount,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  expiredCount: number;
  children: React.ReactNode;
}) {
  const isAllClear = count === 0;
  const hasExpired = expiredCount > 0;

  const iconStyle = isAllClear
    ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
    : hasExpired
      ? "bg-red-50 text-red-600 ring-red-200"
      : "bg-amber-50 text-amber-600 ring-amber-200";

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {isAllClear ? (
                <Badge tone="green">All clear</Badge>
              ) : (
                <>
                  {expiredCount > 0 && <Badge tone="red">{expiredCount} expired</Badge>}
                  {count - expiredCount > 0 && <Badge tone="yellow">{count - expiredCount} expiring</Badge>}
                </>
              )}
            </div>
          </div>
          <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1", iconStyle)}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
      </CardHeader>
      <CardContent className="lg:max-h-[480px] lg:overflow-y-auto">{children}</CardContent>
    </Card>
  );
}

function AlertRow({ severity, children }: { severity: "expired" | "expiring"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-md border-l-2 bg-slate-50 px-3 py-2.5",
        severity === "expired" ? "border-red-400" : "border-amber-400",
      )}
    >
      {children}
    </div>
  );
}

function ClearState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}
