// Shared client-only Google Maps JS API loader for the live-location and
// route-replay maps. Loads the script exactly once per page (singleton promise)
// with the geometry library for heading maths; subsequent callers share it.
// Imported only from "use client" components.

// Inlined at build time by Next for NEXT_PUBLIC_* vars. Empty when unset.
export const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let mapsPromise: Promise<unknown> | null = null;

export function loadGoogleMaps(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  const w = window as unknown as { google?: { maps?: unknown }; __frtInitGoogleMaps?: () => void };
  if (w.google?.maps) return Promise.resolve(w.google.maps);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    w.__frtInitGoogleMaps = () => resolve((window as unknown as { google: { maps: unknown } }).google.maps);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_API_KEY)}&libraries=geometry&callback=__frtInitGoogleMaps`;
    s.async = true;
    s.defer = true;
    s.onerror = () => {
      mapsPromise = null;
      reject(new Error("Google Maps load nahi hua — API key / network check karein."));
    };
    document.head.appendChild(s);
  });
  return mapsPromise;
}
