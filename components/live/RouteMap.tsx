"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { loadGoogleMaps, MAPS_API_KEY } from "@/lib/maps/loader";
import { loadTruckSprite, vehicleImageIcon, vehicleSymbol } from "@/lib/maps/markers";
import type { VehicleRoute } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

const API_KEY = MAPS_API_KEY;

const SPEEDS = [1, 2, 4, 8] as const;
const BASE_POINTS_PER_SEC = 12; // playback rate at 1x

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the Google Maps JS API has no bundled types here. */
export function RouteMap({ route, category }: { route: VehicleRoute; category?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapsRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);
  const moverRef = useRef<any>(null);
  const progressRef = useRef(0); // continuous index into route.points
  const rafRef = useRef<number | null>(null);
  const ptsRef = useRef(route.points);

  const [ready, setReady] = useState(false);
  const [iconTick, setIconTick] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [idx, setIdx] = useState(0); // integer index driving slider + label

  ptsRef.current = route.points;

  useEffect(() => {
    if (!API_KEY) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled) return;
        mapsRef.current = maps;
        setReady(true);
        // Decode the truck sprite in the background; refresh the mover once ready.
        loadTruckSprite()
          .then(() => {
            if (!cancelled) setIconTick((n) => n + 1);
          })
          .catch(() => {});
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Map load nahi hua.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearOverlays = useCallback(() => {
    for (const o of overlaysRef.current) o.setMap(null);
    overlaysRef.current = [];
    if (infoRef.current) {
      infoRef.current.close();
      infoRef.current = null;
    }
    if (moverRef.current) {
      moverRef.current.setMap(null);
      moverRef.current = null;
    }
  }, []);

  // Heading (degrees) at point i: prefer the provider's course, else compute it
  // from this point to the next. Used to orient the top-view vehicle.
  const headingAt = useCallback((i: number) => {
    const pts = ptsRef.current;
    const maps = mapsRef.current;
    if (!maps || pts.length < 2) return 0;
    const a = pts[Math.max(0, Math.min(i, pts.length - 2))];
    if (a.course != null) return a.course;
    const b = pts[Math.max(1, Math.min(i + 1, pts.length - 1))];
    return maps.geometry.spherical.computeHeading(new maps.LatLng(a.lat, a.lng), new maps.LatLng(b.lat, b.lng));
  }, []);

  // Place the moving top-view vehicle along the path and orient it to its heading.
  const moveTo = useCallback(
    (p: number) => {
      const pts = ptsRef.current;
      const maps = mapsRef.current;
      const mover = moverRef.current;
      if (!maps || !mover || pts.length === 0) return;
      const clamped = Math.max(0, Math.min(p, pts.length - 1));
      const i = Math.floor(clamped);
      const frac = clamped - i;
      const a = pts[i];
      const b = pts[Math.min(i + 1, pts.length - 1)];
      mover.setPosition(new maps.LatLng(a.lat + (b.lat - a.lat) * frac, a.lng + (b.lng - a.lng) * frac));
      mover.setIcon(
        vehicleImageIcon(maps, "#1d4ed8", category, headingAt(i)) ??
          vehicleSymbol("#1d4ed8", category, headingAt(i)),
      );
    },
    [headingAt, category],
  );

  // (Re)draw the route whenever it changes or the map becomes ready.
  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const maps = mapsRef.current;
    const pts = route.points;

    if (!mapRef.current) {
      mapRef.current = new maps.Map(containerRef.current, {
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoom: 12,
        center: pts.length ? { lat: pts[0].lat, lng: pts[0].lng } : { lat: 26.85, lng: 80.95 },
      });
    }
    const map = mapRef.current;

    clearOverlays();
    setPlaying(false);
    progressRef.current = 0;
    setIdx(0);
    if (pts.length < 2) return;

    const path = pts.map((p) => ({ lat: p.lat, lng: p.lng }));
    const dot = (color: string, scale: number) => ({
      path: maps.SymbolPath.CIRCLE,
      scale,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#fff",
      strokeWeight: 2,
    });

    const line = new maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#2563eb",
      strokeOpacity: 0.9,
      strokeWeight: 4,
      icons: [
        {
          icon: { path: maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.4, fillColor: "#2563eb", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 1 },
          offset: "0%",
          repeat: "130px",
        },
      ],
      map,
    });
    const start = new maps.Marker({ position: path[0], map, icon: dot("#16a34a", 8), title: "Start", zIndex: 5 });
    const end = new maps.Marker({ position: path[path.length - 1], map, icon: dot("#dc2626", 8), title: "End", zIndex: 5 });
    overlaysRef.current.push(line, start, end);

    infoRef.current = new maps.InfoWindow();
    route.stops.forEach((s, i) => {
      const m = new maps.Marker({ position: { lat: s.lat, lng: s.lng }, map, icon: dot("#f59e0b", 6), title: `Stop ${i + 1}`, zIndex: 4 });
      m.addListener("click", () => {
        const mins = s.durationMs ? Math.round(s.durationMs / 60000) : 0;
        const dur = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
        const arr = timeLabel(s.arrivedAt);
        const dep = timeLabel(s.departedAt);
        const times =
          arr || dep
            ? `<div style="margin-top:3px;color:#475569"><b style="color:#0f172a">${arr || "—"}</b>${dep ? ` &rarr; <b style="color:#0f172a">${dep}</b>` : ""}</div>`
            : "";
        infoRef.current.setContent(
          `<div style="font-size:12px;max-width:230px;line-height:1.45"><b>Stop ${i + 1}</b>${mins ? ` · ${dur}` : ""}${times}${s.address ? `<div style="margin-top:3px;color:#64748b">${s.address}</div>` : ""}</div>`,
        );
        infoRef.current.open({ map, anchor: m });
      });
      overlaysRef.current.push(m);
    });

    moverRef.current = new maps.Marker({
      position: path[0],
      map,
      zIndex: 6,
      icon:
        vehicleImageIcon(maps, "#1d4ed8", category, headingAt(0)) ??
        vehicleSymbol("#1d4ed8", category, headingAt(0)),
    });

    const bounds = new maps.LatLngBounds();
    for (const p of path) bounds.extend(p);
    map.fitBounds(bounds, 48);
  }, [ready, route, clearOverlays, category, headingAt]);

  // Playback loop.
  useEffect(() => {
    if (!playing || !ready) return;
    const pts = ptsRef.current;
    if (pts.length < 2) return;
    let last = performance.now();
    let lastIntIdx = Math.floor(progressRef.current);
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = progressRef.current + dt * BASE_POINTS_PER_SEC * speed;
      if (next >= pts.length - 1) {
        progressRef.current = pts.length - 1;
        moveTo(progressRef.current);
        setIdx(pts.length - 1);
        setPlaying(false);
        return;
      }
      progressRef.current = next;
      moveTo(next);
      const fi = Math.floor(next);
      if (fi !== lastIntIdx) {
        lastIntIdx = fi;
        setIdx(fi);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, ready, moveTo]);

  // Swap the placeholder symbol for the truck sprite once it finishes decoding.
  useEffect(() => {
    if (ready && moverRef.current) moveTo(progressRef.current);
  }, [iconTick, ready, moveTo]);

  const lastIndex = Math.max(0, route.points.length - 1);
  const atEnd = idx >= lastIndex;

  const onPlayPause = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (atEnd) {
      progressRef.current = 0;
      setIdx(0);
      moveTo(0);
    }
    setPlaying(true);
  };
  const onSeek = (v: number) => {
    setPlaying(false);
    progressRef.current = v;
    setIdx(v);
    moveTo(v);
  };
  const onReset = () => {
    setPlaying(false);
    progressRef.current = 0;
    setIdx(0);
    moveTo(0);
  };

  if (!API_KEY) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm font-medium text-slate-600">Google Maps API key set nahi hai</p>
          <p className="mt-1 text-xs text-slate-400">
            Map dikhane ke liye <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> ko{" "}
            <code className="rounded bg-slate-100 px-1">.env.local</code> me add karke dev server restart karein.
          </p>
        </CardContent>
      </Card>
    );
  }

  const current = route.points[Math.min(idx, lastIndex)];

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <div ref={containerRef} className="h-[60vh] min-h-[360px] w-full bg-slate-100" />
        {loadError ? (
          <div className="absolute inset-0 grid place-items-center bg-white/90 p-4 text-center text-sm font-medium text-amber-700">
            {loadError}
          </div>
        ) : !ready ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-50">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden="true" />
          </div>
        ) : null}
      </div>

      {/* Playback controls */}
      <Card>
        <CardContent className="space-y-2 py-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onPlayPause}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 active:scale-95"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-95"
              aria-label="Reset"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={0}
              max={lastIndex}
              step={1}
              value={Math.min(idx, lastIndex)}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-blue-600"
              aria-label="Route position"
            />
            <div className="flex shrink-0 gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-semibold transition",
                    speed === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{current?.time ? timeLabel(current.time) : `Point ${Math.min(idx, lastIndex) + 1} / ${route.points.length}`}</span>
            {current ? <span className="font-semibold text-slate-700">{current.speedKmh} km/h</span> : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
        <LegendDot color="#16a34a" label="Start" />
        <LegendDot color="#dc2626" label="End" />
        <LegendDot color="#f59e0b" label="Stop" />
        <LegendDot color="#1d4ed8" label="Vehicle" />
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
    </span>
  );
}
