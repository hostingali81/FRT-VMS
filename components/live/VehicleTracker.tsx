"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import {
  Battery,
  BatteryCharging,
  ChevronLeft,
  Clock,
  Gauge,
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  MapPin,
  MapPinned,
  OctagonMinus,
  RefreshCw,
  Route,
  SatelliteDish,
  SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LiveVehicleStatus, VehicleLive, VehicleRoute } from "@/lib/types";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { CurrentLocationMap } from "./CurrentLocationMap";
import { RangeSheet, type RouteRange } from "./RangeSheet";
import { STATUS_META } from "./status-meta";

// The replay map drives the imperative Google Maps API + its own runtime, so keep
// it out of SSR entirely (mirrors how /live loads the recharts donut).
const RouteMap = dynamic(() => import("./RouteMap").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-[58vh] min-h-[380px] place-items-center rounded-2xl border border-slate-200 bg-slate-50">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden="true" />
    </div>
  ),
});

// Poll a bit faster than the fleet grid: the detail map glides the marker between
// fixes, so more frequent updates make a moving vehicle read as continuously
// driving. The provider state is cached ~10s server-side, so 15s stays cheap.
const LIVE_REFRESH_MS = 15_000;

type RouteAction = (input: { vehicleId: string; fromISO: string; toISO: string }) => Promise<VehicleRoute>;
type LiveAction = (vehicleId: string) => Promise<VehicleLive>;

function fmtDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function VehicleTracker({
  vehicleId,
  initialLive,
  liveAction,
  routeAction,
}: {
  vehicleId: string;
  initialLive: VehicleLive;
  liveAction: LiveAction;
  routeAction: RouteAction;
}) {
  // Poll the current position while the user is on the live view.
  const { data, isValidating, mutate } = useSWR<VehicleLive>(
    `vehicle-live-${vehicleId}`,
    () => liveAction(vehicleId),
    { fallbackData: initialLive, refreshInterval: LIVE_REFRESH_MS, revalidateOnFocus: true, keepPreviousData: true },
  );
  const snapshot = data ?? initialLive;

  const [view, setView] = useState<"live" | "route">("live");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [route, setRoute] = useState<VehicleRoute | null>(null);
  const [rangeLabel, setRangeLabel] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSelect(range: RouteRange) {
    setRangeLabel(range.label);
    setLoading(true);
    setView("route");
    setSheetOpen(false);
    const res = await routeAction({ vehicleId, fromISO: range.fromISO, toISO: range.toISO });
    setRoute(res);
    setLoading(false);
  }

  if (!snapshot.configured) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <SatelliteDish className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-600">Live GPS tracking not configured</p>
          <p className="mt-1 text-xs text-slate-400">Set the GPS provider credentials to enable tracking.</p>
        </CardContent>
      </Card>
    );
  }

  // No access / not found / no GPS device mapped — nothing trackable to show.
  const noVehicle = !snapshot.ok && snapshot.vehicle.provider == null;
  if (noVehicle) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MapPinned className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-amber-700">{snapshot.error ?? "Is vehicle ka GPS available nahi hai."}</p>
        </CardContent>
      </Card>
    );
  }

  const live = snapshot.live;

  return (
    <>
      {view === "live" ? (
        <LiveView
          live={live}
          fetchedAt={snapshot.fetchedAt}
          provider={snapshot.vehicle.provider}
          unreachable={!snapshot.ok}
          refreshing={isValidating}
          onRefresh={() => mutate()}
          onOpenRange={() => setSheetOpen(true)}
        />
      ) : (
        <RouteView
          loading={loading}
          route={route}
          category={live?.category ?? null}
          rangeLabel={rangeLabel}
          onChange={() => setSheetOpen(true)}
          onBack={() => setView("live")}
        />
      )}

      <RangeSheet open={sheetOpen} loading={loading} onClose={() => setSheetOpen(false)} onSelect={handleSelect} />
    </>
  );
}

// ── Live (default) view ──────────────────────────────────────────────────────
function LiveView({
  live,
  fetchedAt,
  provider,
  unreachable,
  refreshing,
  onRefresh,
  onOpenRange,
}: {
  live: LiveVehicleStatus | null;
  fetchedAt: string;
  provider: VehicleLive["vehicle"]["provider"];
  unreachable: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenRange: () => void;
}) {
  const meta = live ? STATUS_META[live.live_status] : null;

  return (
    <div className="space-y-4">
      {/* Live status strip */}
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live · {formatDateTime(fetchedAt)}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition active:scale-95 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {unreachable ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800">
          Live feed abhi reach nahi hua — last known position dikhaya ja raha hai.
        </p>
      ) : null}

      {/* Map */}
      <div className="relative h-[58vh] min-h-[380px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        {live ? (
          <CurrentLocationMap live={live} />
        ) : (
          <div className="grid h-full w-full place-items-center bg-slate-50 p-6 text-center">
            <div>
              <MapPinned className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-slate-600">Ye vehicle abhi report nahi kar rahi</p>
              <p className="mt-1 text-xs text-slate-400">Route history phir bhi dekh sakte hain.</p>
            </div>
          </div>
        )}

        {/* Floating Route History button, pinned to the map's bottom edge */}
        <button
          type="button"
          onClick={onOpenRange}
          className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-black/10 transition active:scale-95 hover:bg-slate-800"
        >
          <Route className="h-4 w-4" aria-hidden="true" />
          Route History
        </button>
      </div>

      {/* Live detail card */}
      {live ? (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                  meta!.pill,
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", meta!.dot)} aria-hidden="true" />
                {meta!.label}
              </span>
              {live.speed_kmh != null ? (
                <span className={cn("text-right text-2xl font-bold leading-none", meta!.text)}>
                  {live.speed_kmh}
                  <span className="ml-1 text-xs font-medium text-slate-400">km/h</span>
                </span>
              ) : null}
            </div>

            <div className="flex items-start gap-2 text-sm text-slate-700">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="min-w-0">
                {live.address ??
                  (live.latitude != null && live.longitude != null
                    ? `${live.latitude.toFixed(5)}, ${live.longitude.toFixed(5)}`
                    : "Location unavailable")}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {live.last_update ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  {formatDateTime(live.last_update)}
                </span>
              ) : null}
              {live.today_distance_km != null ? (
                <span className="inline-flex items-center gap-1.5">
                  <Route className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  Today {live.today_distance_km} km
                </span>
              ) : null}
              {live.ignition != null ? (
                <span className="inline-flex items-center gap-1.5">
                  <KeyRound className={cn("h-3.5 w-3.5", live.ignition ? "text-emerald-600" : "text-slate-300")} aria-hidden="true" />
                  {live.ignition ? "Ignition on" : "Ignition off"}
                </span>
              ) : null}
              {live.charge != null ? (
                <span className="inline-flex items-center gap-1.5">
                  {live.charge ? (
                    <BatteryCharging className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Battery className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
                  )}
                  {live.charge ? "Charging" : "Not charging"}
                </span>
              ) : null}
              {live.blocked != null ? (
                <span className="inline-flex items-center gap-1.5">
                  {live.blocked ? (
                    <Lock className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                  ) : (
                    <LockOpen className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  )}
                  {live.blocked ? "Engine blocked" : "Unblocked"}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {provider ? (
        <p className="text-center text-xs text-slate-400">
          Source:{" "}
          <span className={cn("font-medium", provider === "WheelsEye" ? "text-violet-600" : "text-sky-600")}>{provider}</span>
        </p>
      ) : null}
    </div>
  );
}

// ── Route history view ───────────────────────────────────────────────────────
function RouteView({
  loading,
  route,
  category,
  rangeLabel,
  onChange,
  onBack,
}: {
  loading: boolean;
  route: VehicleRoute | null;
  category: string | null;
  rangeLabel: string;
  onChange: () => void;
  onBack: () => void;
}) {
  const points = route?.points ?? [];
  const maxSpeed = points.reduce((m, p) => Math.max(m, p.speedKmh), 0);
  const firstTime = points.find((p) => p.time)?.time ?? null;
  const lastTime = [...points].reverse().find((p) => p.time)?.time ?? null;
  const movingMs = firstTime && lastTime ? Date.parse(lastTime) - Date.parse(firstTime) : 0;

  return (
    <div className="space-y-4">
      {/* Top bar: back · range · change */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition active:scale-95 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Live
        </button>
        <span className="min-w-0 flex-1 truncate rounded-full bg-slate-100 px-3 py-1.5 text-center text-xs font-medium text-slate-700">
          {rangeLabel || "Route"}
        </span>
        <button
          type="button"
          onClick={onChange}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition active:scale-95 hover:bg-slate-50 disabled:opacity-60"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Change
        </button>
      </div>

      {loading ? (
        <div className="grid h-[58vh] min-h-[380px] place-items-center rounded-2xl border border-slate-200 bg-slate-50">
          <div className="text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" aria-hidden="true" />
            <p className="mt-3 text-sm text-slate-500">Route load ho raha hai…</p>
          </div>
        </div>
      ) : !route ? null : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<Route className="h-4 w-4" />} label="Distance" value={`${route.totalDistanceKm.toLocaleString("en-IN")} km`} />
            <Stat icon={<Clock className="h-4 w-4" />} label="Running time" value={fmtDuration(movingMs)} />
            <Stat icon={<Gauge className="h-4 w-4" />} label="Max speed" value={maxSpeed > 0 ? `${maxSpeed} km/h` : "—"} />
            <Stat icon={<OctagonMinus className="h-4 w-4" />} label="Stops" value={String(route.stops.length)} />
          </div>

          {!route.ok ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MapPinned className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-amber-700">{route.error ?? "Route load nahi hua."}</p>
                <button type="button" onClick={onChange} className="mt-4 text-sm font-semibold text-blue-600 hover:underline">
                  Doosri range chuno
                </button>
              </CardContent>
            </Card>
          ) : route.points.length < 2 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MapPinned className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-slate-600">Is duration me koi movement record nahi hua.</p>
                <button type="button" onClick={onChange} className="mt-4 text-sm font-semibold text-blue-600 hover:underline">
                  Doosri range chuno
                </button>
              </CardContent>
            </Card>
          ) : (
            <RouteMap route={route} category={category} />
          )}

          {route.provider ? (
            <p className="text-center text-xs text-slate-400">
              Source:{" "}
              <span className={cn("font-medium", route.provider === "WheelsEye" ? "text-violet-600" : "text-sky-600")}>
                {route.provider}
              </span>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <p className="mt-1 truncate text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
