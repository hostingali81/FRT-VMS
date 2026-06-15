import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { GpsDistanceCalculator } from "@/components/gps/GpsDistanceCalculator";
import { getVehicleGpsDistanceAction } from "@/lib/actions/gps-actions";
import { requireProfile } from "@/lib/auth";
import { getVehicles, preloadFleetData } from "@/lib/data";

export const dynamic = "force-dynamic";

const GPS_PROVIDERS = ["VehicleStep", "WheelsEye"];

export default async function GpsDistancePage() {
  // Kick off the fleet query while the auth round trips are still in flight.
  preloadFleetData();
  const profile = await requireProfile();
  const vehicles = await getVehicles(profile);

  // Only GPS-mapped, non-removed vehicles the user can see (getVehicles is
  // already permission-filtered).
  const options = vehicles
    .filter(
      (vehicle) =>
        vehicle.status !== "removed" &&
        vehicle.gps_device_id &&
        vehicle.gps_company &&
        GPS_PROVIDERS.includes(vehicle.gps_company),
    )
    .sort((a, b) => a.registration_no.localeCompare(b.registration_no))
    .map((vehicle) => ({
      vehicle_id: vehicle.vehicle_id,
      registration_no: vehicle.registration_no,
      frt_no: vehicle.frt_no,
      gps_company: vehicle.gps_company,
    }));

  return (
    <AppShell profile={profile}>
      <PageHeader title="GPS Distance" eyebrow="Kilometre calculator" backHref="/dashboard" />

      <div className="mx-auto w-full max-w-xl px-4 py-5 sm:px-6 lg:px-8">
        <p className="mb-4 text-sm text-slate-500">
          Vehicle aur date-time range chuno — us window me GPS se kitne kilometre chala, woh nikal aayega.
        </p>
        <GpsDistanceCalculator vehicles={options} action={getVehicleGpsDistanceAction} />
      </div>
    </AppShell>
  );
}
