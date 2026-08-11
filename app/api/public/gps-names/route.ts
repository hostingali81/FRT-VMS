import { NextResponse } from "next/server";
import { getVehicles } from "@/lib/data";
import { millitrackDeviceName } from "@/lib/device-naming";

// PUBLIC, unauthenticated, read-only endpoint.
// Whitelisted in middleware.ts (publicPaths "/api/public") so it bypasses the
// login gate. Gives a GPS vendor's devices their VMS deployment label, keyed two
// ways so either side of the mapping can be looked up directly.
//
//   GET /api/public/gps-names?provider=VehicleStep
//   GET /api/public/gps-names?provider=WheelsEye
//   GET /api/public/gps-names                      → every provider
//
// Only ACTIVE vehicles are listed. A standby / accident / removed vehicle no
// longer holds its FRT number or substation — those belong to whichever vehicle
// is deployed there now — so listing it would duplicate a live label.
export const dynamic = "force-dynamic";

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

// Loose spellings callers actually type → the gps_company value stored in the VMS.
const PROVIDER_ALIASES: Record<string, string> = {
  vehiclestep: "VehicleStep",
  millitrack: "VehicleStep",
  wheelseye: "WheelsEye",
  wheeleye: "WheelsEye",
  wheelseye_gps: "WheelsEye",
};

/** Tolerant match: case, spacing and the common "Wheeleye" misspelling all pass. */
function matchesProvider(gpsCompany: string | null, query: string): boolean {
  const stored = norm(gpsCompany ?? "");
  const wanted = norm(PROVIDER_ALIASES[norm(query)] ?? query);
  if (!stored || !wanted) return false;
  return stored === wanted || stored.startsWith(wanted) || wanted.startsWith(stored);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = (searchParams.get("provider") ?? searchParams.get("owner") ?? "").trim();

  const vehicles = await getVehicles(); // no profile → unfiltered, whole fleet

  const active = vehicles
    .filter((vehicle) => vehicle.status === "active")
    .filter((vehicle) => (provider ? matchesProvider(vehicle.gps_company, provider) : true));

  // FRT order (FRT 2 before FRT 10), unnumbered last — keeps the JSON stable
  // between calls and readable when someone opens the URL in a browser.
  const frtRank = (frt: string | null) => {
    const match = frt?.match(/\d+/);
    return match ? parseInt(match[0], 10) : Number.POSITIVE_INFINITY;
  };
  active.sort((a, b) => {
    const rankA = frtRank(a.frt_no);
    const rankB = frtRank(b.frt_no);
    if (rankA !== rankB) return rankA - rankB;
    return a.registration_no.localeCompare(b.registration_no);
  });

  const byDeviceId: Record<string, string> = {};
  const byVehicleNo: Record<string, string> = {};

  for (const vehicle of active) {
    // Same label the GPS platforms are renamed to — "FRT 3 J.P NAGAR (UP41CT6929)".
    const label = millitrackDeviceName(vehicle);
    const registration = vehicle.registration_no.trim().toUpperCase();
    const deviceId = (vehicle.gps_device_id ?? "").trim();

    if (registration) byVehicleNo[registration] ??= label;
    // Vehicles without a device id still appear under by_vehicle_no. On the rare
    // duplicate id, the first (lowest FRT) wins rather than being overwritten.
    if (deviceId) byDeviceId[deviceId] ??= label;
  }

  return NextResponse.json(
    {
      provider: provider ? (PROVIDER_ALIASES[norm(provider)] ?? provider) : "all",
      providers: Array.from(
        new Set(vehicles.map((v) => v.gps_company).filter((company): company is string => Boolean(company))),
      ).sort(),
      count: active.length,
      generated_at: new Date().toISOString(),
      by_device_id: byDeviceId,
      by_vehicle_no: byVehicleNo,
    },
    {
      headers: {
        // Open API → allow cross-origin reads from any site/app.
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    },
  );
}
