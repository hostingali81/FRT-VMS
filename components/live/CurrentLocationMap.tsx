"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import { loadGoogleMaps, MAPS_API_KEY } from "@/lib/maps/loader";
import { loadTruckSprite, vehicleImageIcon, vehicleSymbol } from "@/lib/maps/markers";
import type { LiveVehicleStatus } from "@/lib/types";
import { STATUS_META } from "./status-meta";

/* eslint-disable @typescript-eslint/no-explicit-any -- the Google Maps JS API has no bundled types here. */

// Marker glide tuning. When a fresh fix arrives we animate the truck from where it
// currently sits to the new position instead of teleporting — so a moving vehicle
// reads as continuously driving (food-delivery style) rather than jumping on every
// refresh. The glide lasts roughly the real gap between updates, clamped so a long
// GPS gap doesn't crawl and a tiny one isn't instant.
const GLIDE_MIN_MS = 700;
const GLIDE_MAX_MS = 8000;
const GLIDE_DEFAULT_MS = 1500;
const MOVE_EPSILON_M = 2; // ignore sub-2m jitter (don't animate / re-orient for it)

// Dead-reckoning ("coast"): GPS fixes only arrive every ~15-30s, so between them we
// keep a running truck moving forward along its last heading at its reported speed —
// that's how delivery apps look alive the instant you open them, instead of sitting
// still until the next fix lands. The next real fix smoothly corrects any drift.
const COAST_MIN_SPEED_KMH = 5; // below this, treat as parked — don't coast
const COAST_MAX_MS = 60_000; // stop coasting if fixes dry up, so it can't run away
const DT_CLAMP_S = 1; // cap per-frame step (e.g. after a backgrounded tab) to avoid a jump

// easeInOutQuad — gentle start/stop so the glide doesn't look mechanical.
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * Single-marker map for a vehicle's current/last reported position. Shown as the
 * default view of /live/[vehicleId] before any route history is requested.
 *
 * The marker is colour-coded by live status, oriented along its heading, glides
 * smoothly to each new fix, and dead-reckons forward between fixes — so a running
 * vehicle starts moving as soon as the map opens and keeps moving like a live
 * delivery tracker.
 */
export function CurrentLocationMap({ live }: { live: LiveVehicleStatus }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapsRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null); // holds whichever animation is active (glide or coast)
  const curPosRef = useRef<{ lat: number; lng: number } | null>(null); // marker's rendered position
  const targetRef = useRef<{ lat: number; lng: number } | null>(null); // last real fix we animated toward
  const headingRef = useRef(0);
  const lastIconRef = useRef<any>(null); // skip redundant setIcon (data-URL reload stutters)
  const lastFixAtRef = useRef(0); // wall-clock of the last accepted fix, for adaptive glide
  const liveRef = useRef(live); // latest props, so the coast loop reads fresh speed/heading/status
  liveRef.current = live;

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

  // Draw / animate the marker whenever the map is ready or the live fix changes.
  useEffect(() => {
    if (!ready || !containerRef.current || !hasPos) return;
    const maps = mapsRef.current;
    const target = { lat: lat as number, lng: lng as number };

    // Apply the icon for a heading, skipping the call when the cached icon is
    // unchanged (5° buckets) so a per-frame animation doesn't reload the data-URL.
    // Reads colour/category from liveRef so a long-lived coast loop stays current.
    const applyIcon = (heading: number) => {
      const l = liveRef.current;
      const col = STATUS_META[l.live_status].hex;
      const icon = vehicleImageIcon(maps, col, l.category, heading) ?? vehicleSymbol(col, l.category, heading);
      if (icon !== lastIconRef.current) {
        markerRef.current.setIcon(icon);
        lastIconRef.current = icon;
      }
    };

    // Dead-reckon forward from the marker's current spot while the vehicle is
    // running, until the next real fix arrives (which cancels this) or COAST_MAX_MS.
    const startCoast = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      let last = performance.now();
      const startedAt = last;
      const loop = (ts: number) => {
        const l = liveRef.current;
        const speed = l.speed_kmh ?? 0;
        if (l.live_status !== "running" || speed < COAST_MIN_SPEED_KMH || ts - startedAt > COAST_MAX_MS) {
          rafRef.current = null;
          return;
        }
        const cur = curPosRef.current;
        if (!cur) {
          rafRef.current = null;
          return;
        }
        const dt = Math.min(DT_CLAMP_S, (ts - last) / 1000);
        last = ts;
        const heading = l.course ?? headingRef.current;
        const meters = (speed / 3.6) * dt;
        const off = maps.geometry.spherical.computeOffset(new maps.LatLng(cur.lat, cur.lng), meters, heading);
        const p = { lat: off.lat(), lng: off.lng() };
        markerRef.current.setPosition(p);
        curPosRef.current = p;
        headingRef.current = heading;
        applyIcon(heading);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    };

    const maybeCoast = () => {
      const l = liveRef.current;
      if (l.live_status === "running" && (l.speed_kmh ?? 0) >= COAST_MIN_SPEED_KMH) startCoast();
    };

    // First render: create the map + marker in place, then start coasting right away
    // so a running vehicle is already moving when the map opens.
    if (!mapRef.current) {
      mapRef.current = new maps.Map(containerRef.current, {
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: "greedy",
        clickableIcons: false,
        zoom: 15,
        center: target,
      });
      markerRef.current = new maps.Marker({ map: mapRef.current, position: target, zIndex: 5, title: live.address ?? "" });

      // Click listener to show "Get Direction" option
      const infoWindow = new maps.InfoWindow();
      markerRef.current.addListener("click", () => {
        const currentPos = curPosRef.current || targetRef.current || target;
        const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${currentPos.lat},${currentPos.lng}`;
        const label = liveRef.current.frt_no
          ? `FRT: ${liveRef.current.frt_no} (${liveRef.current.registration_no})`
          : liveRef.current.registration_no;
        const address = liveRef.current.address || "Live Location";

        infoWindow.setContent(`
          <div style="padding: 6px; font-family: system-ui, -apple-system, sans-serif; min-width: 160px; max-width: 220px;">
            <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-bottom: 2px;">
              ${label}
            </div>
            <div style="color: #64748b; font-size: 11px; margin-bottom: 8px; line-height: 1.3; word-wrap: break-word;">
              ${address}
            </div>
            <a href="${dirUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; justify-content: center; background-color: #2563eb; color: #ffffff; padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; text-decoration: none; width: 100%; box-sizing: border-box; text-align: center; border: none; cursor: pointer;">
              Get Direction
            </a>
          </div>
        `);
        infoWindow.open(mapRef.current, markerRef.current);
      });

      curPosRef.current = target;
      targetRef.current = target;
      headingRef.current = live.course ?? 0;
      lastFixAtRef.current = performance.now();
      applyIcon(headingRef.current);
      maybeCoast();
      return;
    }

    const map = mapRef.current;
    const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
      maps.geometry.spherical.computeDistanceBetween(new maps.LatLng(a.lat, a.lng), new maps.LatLng(b.lat, b.lng));

    // The effect also re-runs for icon/colour/speed changes — if the fix itself
    // didn't move, just refresh the icon (the coast loop, if any, keeps running and
    // reads fresh speed/heading on its own).
    const prev = targetRef.current;
    if (prev && dist(prev, target) < MOVE_EPSILON_M) {
      applyIcon(headingRef.current);
      return;
    }

    // New fix → glide from the marker's current (possibly coasted) spot to it,
    // correcting any dead-reckoning drift, then resume coasting.
    const from = curPosRef.current ?? prev ?? target;
    const moved = dist(from, target);
    const heading =
      moved >= MOVE_EPSILON_M
        ? maps.geometry.spherical.computeHeading(new maps.LatLng(from.lat, from.lng), new maps.LatLng(target.lat, target.lng))
        : live.course ?? headingRef.current;
    headingRef.current = heading;
    targetRef.current = target;

    const now = performance.now();
    const gap = lastFixAtRef.current ? now - lastFixAtRef.current : GLIDE_DEFAULT_MS;
    lastFixAtRef.current = now;
    const dur = Math.min(GLIDE_MAX_MS, Math.max(GLIDE_MIN_MS, gap));

    // Gently bring the camera to the new fix once; the marker glides in to meet it.
    map.panTo(target);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = now;
    const f0 = from;
    const step = (ts: number) => {
      const t = Math.min(1, (ts - start) / dur);
      const e = ease(t);
      const p = { lat: f0.lat + (target.lat - f0.lat) * e, lng: f0.lng + (target.lng - f0.lng) * e };
      markerRef.current.setPosition(p);
      curPosRef.current = p;
      applyIcon(heading);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        curPosRef.current = target;
        rafRef.current = null;
        maybeCoast();
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [ready, iconTick, hasPos, lat, lng, color, live.category, live.course, live.live_status, live.speed_kmh, live.address]);

  // Stop any in-flight animation on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const recenter = () => {
    if (mapRef.current && curPosRef.current) {
      mapRef.current.panTo(curPosRef.current);
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
