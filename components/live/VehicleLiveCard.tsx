import Link from "next/link";
import {
  Battery,
  BatteryCharging,
  KeyRound,
  Lock,
  LockOpen,
  MapPin,
  SatelliteDish,
  Truck,
} from "lucide-react";
import type { LiveProvider, LiveVehicleStatus } from "@/lib/types";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { STATUS_META } from "./status-meta";

// GPS provider chip styling, mirroring the live detail page (WheelsEye = violet,
// VehicleStep/Millitrack = sky).
const PROVIDER_META: Record<LiveProvider, string> = {
  WheelsEye: "bg-violet-50 text-violet-700 ring-violet-200",
  VehicleStep: "bg-sky-50 text-sky-700 ring-sky-200",
};

function locationText(vehicle: LiveVehicleStatus): string {
  if (vehicle.address) return vehicle.address;
  if (vehicle.latitude != null && vehicle.longitude != null) {
    return `${vehicle.latitude.toFixed(4)}, ${vehicle.longitude.toFixed(4)}`;
  }
  return "Location unavailable";
}

// Always build the title from the VMS fields so both providers read the same:
// "<frt> <substation> (<registration>)", falling back to whatever is present.
// (We deliberately ignore the GPS device's own name — e.g. VehicleStep/Millitrack
// ships a raw "FRT 7 SATRIKH (UP41AT8227)" — and rename from VMS data instead,
// matching the detail page and the WheelsEye cards.)
function vehicleTitle(vehicle: LiveVehicleStatus): string {
  const prefix = [vehicle.frt_no, vehicle.substation].filter(Boolean).join(" ").trim();
  return prefix ? `${prefix} (${vehicle.registration_no})` : vehicle.registration_no;
}

export function VehicleLiveCard({ vehicle }: { vehicle: LiveVehicleStatus }) {
  const meta = STATUS_META[vehicle.live_status];

  return (
    <Link
      href={`/live/${vehicle.vehicle_id}`}
      className="group flex overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-black/[0.02] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:scale-[0.98] active:shadow-sm"
    >
      {/* Colour-coded status edge */}
      <span className={cn("w-1.5 shrink-0", meta.accent)} aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        {/* Header: icon + name/status + GPS provider */}
        <div className="flex items-center gap-2.5">
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", meta.soft)}>
            <Truck className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-slate-900">{vehicleTitle(vehicle)}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                  meta.pill,
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden="true" />
                {meta.label}
              </span>
              {vehicle.last_update ? (
                <span className="truncate text-[11px] text-slate-400">{formatDateTime(vehicle.last_update)}</span>
              ) : null}
            </div>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 self-start rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
              PROVIDER_META[vehicle.provider],
            )}
            title={`GPS: ${vehicle.provider}`}
          >
            <SatelliteDish className="h-3 w-3" aria-hidden="true" />
            {vehicle.provider}
          </span>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate">{locationText(vehicle)}</span>
        </div>

        {/* Footer: today's distance is the hero; speed + device flags are secondary */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <p className="flex items-baseline gap-1 leading-none">
            <span className="text-xl font-bold tracking-tight text-slate-900">
              {vehicle.today_distance_km != null ? vehicle.today_distance_km.toLocaleString("en-IN") : "—"}
            </span>
            <span className="text-[11px] font-medium text-slate-400">km today</span>
          </p>

          <div className="flex shrink-0 items-center gap-2.5">
            {/* Device flags */}
            {vehicle.ignition != null ? (
              <KeyRound
                className={cn("h-4 w-4", vehicle.ignition ? "text-emerald-600" : "text-slate-300")}
                aria-label={vehicle.ignition ? "Ignition on" : "Ignition off"}
              />
            ) : null}
            {vehicle.charge != null ? (
              vehicle.charge ? (
                <BatteryCharging className="h-4 w-4 text-emerald-600" aria-label="Charging" />
              ) : (
                <Battery className="h-4 w-4 text-slate-300" aria-label="Not charging" />
              )
            ) : null}
            {vehicle.blocked != null ? (
              vehicle.blocked ? (
                <Lock className="h-4 w-4 text-red-600" aria-label="Engine blocked" />
              ) : (
                <LockOpen className="h-4 w-4 text-emerald-600" aria-label="Engine unblocked" />
              )
            ) : null}

            {/* Speed — secondary to today's distance */}
            <span className="flex items-baseline gap-0.5 leading-none">
              <span className={cn("text-sm font-bold", meta.text)}>
                {vehicle.speed_kmh != null ? vehicle.speed_kmh : "—"}
              </span>
              <span className="text-[10px] font-medium text-slate-400">km/h</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
