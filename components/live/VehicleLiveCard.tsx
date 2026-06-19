import Link from "next/link";
import {
  Battery,
  BatteryCharging,
  KeyRound,
  Lock,
  LockOpen,
  MapPin,
  Truck,
} from "lucide-react";
import type { LiveVehicleStatus } from "@/lib/types";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { STATUS_META } from "./status-meta";

function locationText(vehicle: LiveVehicleStatus): string {
  if (vehicle.address) return vehicle.address;
  if (vehicle.latitude != null && vehicle.longitude != null) {
    return `${vehicle.latitude.toFixed(4)}, ${vehicle.longitude.toFixed(4)}`;
  }
  return "Location unavailable";
}

// Millitrack devices carry a ready-made name ("FRT 7 SATRIKH (UP41AT8227)").
// WheelsEye has none, so build the same shape from the VMS fields:
// "<frt> <substation> (<registration>)", falling back to whatever is present.
function vehicleTitle(vehicle: LiveVehicleStatus): string {
  if (vehicle.device_name) return vehicle.device_name;
  const prefix = [vehicle.frt_no, vehicle.substation].filter(Boolean).join(" ").trim();
  return prefix ? `${prefix} (${vehicle.registration_no})` : vehicle.registration_no;
}

export function VehicleLiveCard({ vehicle }: { vehicle: LiveVehicleStatus }) {
  const meta = STATUS_META[vehicle.live_status];

  return (
    <Link
      href={`/live/${vehicle.vehicle_id}`}
      className="group flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
    >
      {/* Colour-coded status edge */}
      <span className={cn("w-1.5 shrink-0", meta.accent)} aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        {/* Row 1: icon + name + speed */}
        <div className="flex items-center gap-2.5">
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", meta.soft)}>
            <Truck className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
            {vehicleTitle(vehicle)}
          </p>
          {vehicle.speed_kmh != null ? (
            <span className={cn("shrink-0 text-right text-base font-bold leading-none", meta.text)}>
              {vehicle.speed_kmh}
              <span className="ml-0.5 text-[11px] font-medium text-slate-400">km/h</span>
            </span>
          ) : null}
        </div>

        {/* Row 2: location + today distance */}
        <div className="flex items-center gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate">{locationText(vehicle)}</span>
          </span>
          {vehicle.today_distance_km != null ? (
            <span className="shrink-0 text-xs font-medium text-slate-500">{vehicle.today_distance_km} km</span>
          ) : null}
        </div>

        {/* Row 3: status pill + time, then device flags */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
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

          <div className="flex shrink-0 items-center gap-2.5">
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
          </div>
        </div>
      </div>
    </Link>
  );
}
