"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import { loadGoogleMaps, MAPS_API_KEY } from "@/lib/maps/loader";
import { loadTruckSprite, vehicleImageIcon, vehicleSymbol } from "@/lib/maps/markers";
import type { LiveVehicleStatus } from "@/lib/types";
import { STATUS_META } from "./status-meta";

/* eslint-disable @typescript-eslint/no-explicit-any -- the Google Maps JS API has no bundled types here. */

/**
 * Single-marker map for a vehicle's current/last reported position. Shown as the
 * default view of /live/[vehicleId] before any route history is requested.
 * The marker is colour-coded by live status and points along the last heading
 * when the vehicle is moving.
 */
export function CurrentLocationMap({ live }: { live: LiveVehicleStatus }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapsRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [iconTick, setIconTick] = useState(0);
  const [loadError, setLoadError] = useState("");

  const lat = live.latitude;
  const lng = live.longitude;
  const hasPos = lat != null && lng != null;
  const color = STATUS_META[live.live_status].hex;

  useEffect(() => {
    if (!MAPS_API_KEY) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled) return;
        mapsRef.current = maps;
        setReady(true);
        // Decode the truck sprite in the background; redraw once it's ready.
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

  // Draw / update the marker whenever the map is ready or the position changes.
  useEffect(() => {
    if (!ready || !containerRef.current || !hasPos) return;
    const maps = mapsRef.current;
    const pos = { lat: lat as number, lng: lng as number };

    if (!mapRef.current) {
      mapRef.current = new maps.Map(containerRef.current, {
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: "greedy",
        clickableIcons: false,
        zoom: 15,
        center: pos,
      });
    }
    const map = mapRef.current;

    // Top-view vehicle, oriented to its last heading (course) when known.
    if (!markerRef.current) {
      markerRef.current = new maps.Marker({ map, position: pos, zIndex: 5, title: live.address ?? "" });
    }
    markerRef.current.setPosition(pos);
    markerRef.current.setIcon(
      vehicleImageIcon(maps, color, live.category, live.course ?? 0) ??
        vehicleSymbol(color, live.category, live.course ?? 0),
    );
    map.panTo(pos);
  }, [ready, iconTick, hasPos, lat, lng, color, live.category, live.course, live.address]);

  const recenter = () => {
    if (mapRef.current && hasPos) {
      mapRef.current.panTo({ lat: lat as number, lng: lng as number });
      mapRef.current.setZoom(16);
    }
  };

  if (!MAPS_API_KEY) {
    return (
      <div className="grid h-full w-full place-items-center bg-slate-50 p-6 text-center">
        <div>
          <p className="text-sm font-medium text-slate-600">Google Maps API key set nahi hai</p>
          <p className="mt-1 text-xs text-slate-400">
            Map ke liye <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> add karein.
          </p>
        </div>
      </div>
    );
  }

  if (!hasPos) {
    return (
      <div className="grid h-full w-full place-items-center bg-slate-50 p-6 text-center">
        <div>
          <LocateFixed className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-slate-600">Location abhi available nahi hai</p>
          <p className="mt-1 text-xs text-slate-400">Ye vehicle filhaal apni position report nahi kar rahi.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="h-full w-full bg-slate-100" />
      {loadError ? (
        <div className="absolute inset-0 grid place-items-center bg-white/90 p-4 text-center text-sm font-medium text-amber-700">
          {loadError}
        </div>
      ) : !ready ? (
        <div className="absolute inset-0 grid place-items-center bg-slate-50">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden="true" />
        </div>
      ) : (
        <button
          type="button"
          onClick={recenter}
          aria-label="Recenter"
          className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-slate-700 shadow-md ring-1 ring-black/5 backdrop-blur transition active:scale-95"
        >
          <LocateFixed className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      )}
    </>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
