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
    // Sort by FRT No (natural/numeric so FRT-2 comes before FRT-10); vehicles
    // without an FRT No fall to the end, then ordered by registration.
    .sort((a, b) => {
      if (!a.frt_no && !b.frt_no) return a.registration_no.localeCompare(b.registration_no);
      if (!a.frt_no) return 1;
      if (!b.frt_no) return -1;
      return a.frt_no.localeCompare(b.frt_no, undefined, { numeric: true, sensitivity: "base" });
    })
    .map((vehicle) => ({
      vehicle_id: vehicle.vehicle_id,
      registration_no: vehicle.registration_no,
      frt_no: vehicle.frt_no,
      substation: vehicle.substation,
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
