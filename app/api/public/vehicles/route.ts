import { NextResponse } from "next/server";
import { getVehicles } from "@/lib/data";

// PUBLIC, unauthenticated, read-only endpoint.
// Whitelisted in middleware.ts (publicPaths "/api/public") so it bypasses the
// login gate. Returns the whole fleet's basic deployment + GPS + vendor fields.
//
//   GET /api/public/vehicles            → all vehicles
//   GET /api/public/vehicles?frt=FRT 1  → filter by FRT number (case-insensitive)
//   GET /api/public/vehicles?reg=UP41…  → filter by registration (case-insensitive)
//
// NOTE: this is intentionally open — anyone with the URL can read these fields
// (incl. GPS device id and vendor). It exposes no owner contact / documents.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const frt = searchParams.get("frt")?.trim().toLowerCase();
  const reg = searchParams.get("reg")?.trim().toLowerCase().replace(/\s+/g, "");

  const vehicles = await getVehicles(); // no profile → unfiltered, whole fleet

  const data = vehicles
    .filter((v) => v.status !== "removed")
    .filter((v) => (frt ? (v.frt_no ?? "").toLowerCase() === frt : true))
    .filter((v) => (reg ? v.registration_no.toLowerCase().replace(/\s+/g, "").includes(reg) : true))
    .map((v) => ({
      registration_no: v.registration_no,
      frt_no: v.frt_no,
      circle: v.current_circle ?? v.home_circle,
      division: v.division,
      substation: v.substation,
      gps_company: v.gps_company,
      gps_device_id: v.gps_device_id,
      vendor_name: v.vendor_name,
      status: v.status,
    }));

  return NextResponse.json(
    { count: data.length, vehicles: data },
    {
      headers: {
        // Open API → allow cross-origin reads from any site/app.
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    },
  );
}
