import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { QuickFuelForm } from "@/components/fuel/QuickFuelForm";
import { addFuelLogAction } from "@/lib/actions/vehicle-actions";
import { requireProfile } from "@/lib/auth";
import { getAllLookups, getVehicles } from "@/lib/data";
import { canEditVehicle } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AddFuelEntryPage({
  searchParams,
}: {
  searchParams: { added?: string; error?: string };
}) {
  const profile = await requireProfile();
  const [vehicles, lookups] = await Promise.all([getVehicles(profile), getAllLookups()]);

  // Only company-fuel vehicles the user can edit, not removed
  const options = vehicles
    .filter((v) => v.fuel_ownership === "company" && v.status !== "removed" && canEditVehicle(profile, v, lookups))
    .sort((a, b) => a.registration_no.localeCompare(b.registration_no))
    .map((v) => ({
      vehicle_id: v.vehicle_id,
      registration_no: v.registration_no,
      division: v.division,
      fuel_type: v.fuel_type,
    }));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Add Fuel Entry" eyebrow="Quick fuel log" backHref="/fuel-log" />

      <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8">
        {searchParams.added && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            {searchParams.added} ki fuel entry save ho gayi. Agli entry daal sakte ho.
          </div>
        )}
        {searchParams.error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
            {searchParams.error}
          </div>
        )}

        {options.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm font-medium text-slate-600">Koi company-fuel vehicle nahi mila</p>
              <p className="mt-1 text-xs text-slate-400">
                Fuel entry sirf company-fuel vehicles ke liye hoti hai.{" "}
                <Link href="/fuel" className="text-slate-700 underline">
                  Fuel Dashboard
                </Link>{" "}
                dekho.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <QuickFuelForm vehicles={options} action={addFuelLogAction} today={today} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
