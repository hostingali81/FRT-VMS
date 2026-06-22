"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { RefreshCw, SatelliteDish, Search, X } from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import type { FleetLiveStatus, LiveStatus } from "@/lib/types";
import { LIVE_STATUSES } from "@/lib/types";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { DonutSkeleton } from "./DonutSkeleton";
import { STATUS_META } from "./status-meta";
import { VehicleLiveCard } from "./VehicleLiveCard";

// recharts is browser-only and bundles its own React/redux runtime; importing it
// into the server render caused a duplicate-React "Invalid hook call" on /live.
// Loading the donut with ssr:false keeps recharts entirely out of the SSR graph.
const FleetStatusDonut = dynamic(() => import("./FleetStatusDonut").then((m) => m.FleetStatusDonut), {
  ssr: false,
  loading: () => <DonutSkeleton />,
});

const REFRESH_MS = 30_000;
type Filter = LiveStatus | "all";

export function LiveTracking({
  initial,
  action,
}: {
  initial: FleetLiveStatus;
  action: () => Promise<FleetLiveStatus>;
}) {
  const { data, isValidating, mutate } = useSWR<FleetLiveStatus>("fleet-live", () => action(), {
    fallbackData: initial,
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const snapshot = data ?? initial;

  if (!snapshot.configured) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <SatelliteDish className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-600">Live GPS tracking not configured</p>
          <p className="mt-1 text-xs text-slate-400">
            Set the GPS provider credentials to enable real-time tracking.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filter chips: "All" plus every status that actually has vehicles.
  const activeStatuses = LIVE_STATUSES.filter((s) => snapshot.counts[s] > 0);

  // Status chip + free-text search (FRT, registration, substation, division,
  // circle, vendor, device name, last-known address) applied together.
  const q = query.trim().toLowerCase();
  const vehicles = snapshot.vehicles.filter((v) => {
    if (filter !== "all" && v.live_status !== filter) return false;
    if (!q) return true;
    return [v.frt_no, v.registration_no, v.substation, v.division, v.circle, v.vendor_name, v.device_name, v.address]
      .some((field) => field?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      {/* Refresh status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live · last {formatDateTime(snapshot.fetchedAt)}
        </p>
        <Button type="button" variant="outline" onClick={() => mutate()} disabled={isValidating} className="h-8 px-3 text-xs">
          <RefreshCw className={cn("h-4 w-4", isValidating && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {!snapshot.ok ? (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm font-medium text-amber-700">{snapshot.error ?? "Couldn't load live data"}</p>
            <p className="mt-1 text-xs text-slate-400">Showing the last snapshot. Retrying automatically.</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Status donut (tap a slice to filter, center to reset) */}
      <Card>
        <CardContent className="pb-3">
          <FleetStatusDonut counts={snapshot.counts} selected={filter} onSelect={setFilter} />
        </CardContent>
      </Card>

      {/* Native-style segmented filter chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip
          label="All"
          count={snapshot.counts.total}
          active={filter === "all"}
          onClick={() => setFilter("all")}
          activeClass="bg-slate-900 text-white"
        />
        {activeStatuses.map((status) => {
          const meta = STATUS_META[status];
          return (
            <FilterChip
              key={status}
              label={meta.label}
              count={snapshot.counts[status]}
              dot={meta.dot}
              active={filter === status}
              onClick={() => setFilter(filter === status ? "all" : status)}
              activeClass={cn(meta.pill, "ring-2")}
            />
          );
        })}
      </div>

      {/* Search by FRT / registration / location */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search FRT, registration, vendor…"
          aria-label="Search vehicles"
          className="pl-9 pr-9"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Vehicle cards */}
      {vehicles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium text-slate-600">
              {q
                ? `No vehicles match “${query.trim()}”`
                : filter === "all"
                  ? "No live GPS vehicles to show"
                  : `No ${STATUS_META[filter].label.toLowerCase()} vehicles`}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {q
                ? "Try a different FRT number, registration, or location."
                : filter === "all"
                  ? "Live tracking covers vehicles with a VehicleStep GPS device mapped."
                  : "Tap All to see the whole fleet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {vehicles.map((vehicle) => (
              <VehicleLiveCard key={vehicle.vehicle_id} vehicle={vehicle} />
            ))}
          </div>
          {filter === "all" && !q && snapshot.untracked > 0 ? (
            <p className="text-center text-xs text-slate-400">
              {snapshot.untracked} GPS-mapped vehicle{snapshot.untracked === 1 ? "" : "s"} not reporting live right now.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  dot,
  active,
  onClick,
  activeClass,
}: {
  label: string;
  count: number;
  dot?: string;
  active: boolean;
  onClick: () => void;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition active:scale-95",
        active ? activeClass : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden="true" /> : null}
      {label}
      <span className={cn("font-semibold", active ? "" : "text-slate-900")}>{count}</span>
    </button>
  );
}
