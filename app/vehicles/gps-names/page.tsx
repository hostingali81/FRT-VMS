import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { applyMillitrackNamesAction } from "@/lib/actions/device-name-actions";
import { requireProfile } from "@/lib/auth";
import { planMillitrackNames } from "@/lib/device-naming";

export const dynamic = "force-dynamic";
// The apply action renames devices one at a time against a third-party platform,
// so the whole fleet can take well past the default serverless limit.
export const maxDuration = 60;

export default async function GpsNamesPage({
  searchParams,
}: {
  searchParams?: { renamed?: string; failed?: string; failedRegs?: string; error?: string };
}) {
  const profile = await requireProfile();
  // Fleet-wide write to the GPS platform — super_admin only.
  if (profile.role !== "super_admin") redirect("/vehicles");

  const plan = await planMillitrackNames(profile);
  const renamed = Number(searchParams?.renamed ?? 0);
  const failed = Number(searchParams?.failed ?? 0);

  return (
    <AppShell profile={profile}>
      <PageHeader title="GPS Device Names" eyebrow="VehicleStep (Millitrack)" backHref="/vehicles" />

      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <p className="mb-4 max-w-3xl text-sm text-slate-500">
          GPS dashboard par har device ka naam VMS ke record jaisa kar deta hai — active vehicle ka{" "}
          <span className="font-medium text-slate-700">FRT No Substation (Vehicle No)</span>, aur jo active nahi hai
          uska sirf vehicle number. Neeche preview dekh kar hi apply karein; GPS platform par undo nahi hota.
        </p>

        {searchParams?.error ? (
          <Banner tone="red">{searchParams.error}</Banner>
        ) : renamed || failed ? (
          <Banner tone={failed ? "yellow" : "green"}>
            {renamed} device rename hue{failed ? `, ${failed} fail` : ""}.
            {searchParams?.failedRegs ? ` Fail: ${searchParams.failedRegs}` : ""}
          </Banner>
        ) : null}

        {!plan.ok ? (
          <Banner tone="red">{plan.error}</Banner>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Stat label="Rename honge" value={plan.changed} tone={plan.changed ? "amber" : "slate"} />
              <Stat label="Already sahi" value={plan.unchanged} tone="slate" />
              {plan.missingOnMillitrack ? (
                <Stat label="Millitrack par nahi mile" value={plan.missingOnMillitrack} tone="red" />
              ) : null}
              {plan.unmappedDevices ? (
                <Stat label="VMS se unmapped (chhode jayenge)" value={plan.unmappedDevices} tone="slate" />
              ) : null}
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[46rem] text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Vehicle</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Abhi ka naam</th>
                        <th className="px-4 py-3 font-semibold">Naya naam</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {plan.rows.map((row) => (
                        <tr key={row.vehicle_id} className={row.changed ? "bg-amber-50/60" : undefined}>
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-900">{row.registration_no}</span>
                            <span className="block text-xs text-slate-400">Device {row.device_id}</span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.currentName || "—"}</td>
                          <td className="px-4 py-3">
                            {row.changed ? (
                              <span className="inline-flex items-center gap-2 font-medium text-slate-900">
                                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                                {row.targetName}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 text-slate-400">
                                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                                Koi badlav nahi
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              {plan.changed ? (
                <form action={applyMillitrackNamesAction}>
                  <SubmitButton>{plan.changed} device rename karo</SubmitButton>
                </form>
              ) : (
                <p className="text-sm text-slate-500">Sab naam already sahi hain — kuch karne ki zarurat nahi.</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "amber" | "slate" | "red" }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    slate: "border-slate-200 bg-white text-slate-700",
    red: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>
      <span className="font-semibold">{value}</span> <span className="text-xs">{label}</span>
    </div>
  );
}

function Banner({ tone, children }: { tone: "green" | "yellow" | "red"; children: React.ReactNode }) {
  const tones = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    yellow: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {tone === "green" ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  );
}
