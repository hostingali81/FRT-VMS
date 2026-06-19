// Vehicle markers for the live + route-replay maps.
//
// Trucks/vans use a PNG sprite (public/markers/truck.png) — a top/front view that
// points "up" at heading 0 — drawn on a status-coloured halo and rotated to the
// vehicle's heading so it faces the way it's moving (like a navigation arrow).
// Two-wheelers, and any moment before the sprite has decoded, fall back to a
// vector silhouette (a Google Maps Symbol) that also rotates to the heading.

/* eslint-disable @typescript-eslint/no-explicit-any -- the Google Maps JS API has no bundled types here. */

// Narrow top-view two-wheeler, drawn around its centre, pointing "up" at rotation 0.
const BIKE_PATH = "M0,-13 Q3,-13 3,-9 L3,9 Q3,13 0,13 Q-3,13 -3,9 L-3,-9 Q-3,-13 0,-13 Z";
// Elongated top-view truck/van — the fallback silhouette used until the PNG loads.
const TRUCK_PATH =
  "M0,-18 Q6,-18 6,-12 L6,-6 L8,-4 L8,14 Q8,17 5,17 L-5,17 Q-8,17 -8,14 L-8,-4 L-6,-6 L-6,-12 Q-6,-18 0,-18 Z";

export function isBike(category?: string | null): boolean {
  const c = (category ?? "").toLowerCase().trim();
  return c === "motorcycle" || c === "bike" || c === "scooter";
}

/** Google Maps Symbol for a top-view vehicle, oriented to `rotation` degrees. */
export function vehicleSymbol(color: string, category?: string | null, rotation = 0) {
  return {
    path: isBike(category) ? BIKE_PATH : TRUCK_PATH,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
    scale: 1.1,
    rotation,
  };
}

// ── Truck PNG sprite ─────────────────────────────────────────────────────────
const TRUCK_SRC = "/markers/truck.png";
const BOX = 54; // icon footprint on the map (px), halo included — keeps a steady size whatever the PNG's aspect
const TRUCK_LEN = 40; // the truck's longest side within the box (px)
const DPR = 2; // render at 2× for crisp icons on retina screens
const ANGLE_STEP = 5; // cache rotated icons in 5° buckets

let truckImg: HTMLImageElement | null = null;
let truckImgPromise: Promise<HTMLImageElement> | null = null;
const iconCache = new Map<string, any>();

/** Decode the truck sprite once (client-only). Resolves when it's ready to draw. */
export function loadTruckSprite(): Promise<HTMLImageElement> {
  if (truckImg) return Promise.resolve(truckImg);
  if (truckImgPromise) return truckImgPromise;
  truckImgPromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      truckImg = img;
      resolve(img);
    };
    img.onerror = () => {
      truckImgPromise = null;
      reject(new Error("Truck marker image load nahi hui."));
    };
    img.src = TRUCK_SRC;
  });
  return truckImgPromise;
}

function rgba(hex: string, a: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * Google Maps icon for a truck on a status-coloured halo, rotated to `heading`.
 * Returns null for two-wheelers, or before the sprite has decoded — callers then
 * fall back to vehicleSymbol(). Built icons are cached per colour + 5° heading
 * bucket so playback re-uses them instead of re-encoding the canvas every frame.
 */
export function vehicleImageIcon(maps: any, color: string, category: string | null | undefined, heading = 0): any | null {
  const img = truckImg;
  if (!img || isBike(category)) return null;

  const bucket = (((Math.round(heading / ANGLE_STEP) * ANGLE_STEP) % 360) + 360) % 360;
  const key = `${color}|${bucket}`;
  const hit = iconCache.get(key);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  canvas.width = BOX * DPR;
  canvas.height = BOX * DPR;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(DPR, DPR);

  const c = BOX / 2;
  // Status-coloured halo: a soft tinted disc with a solid ring on top.
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fillStyle = rgba(color, 0.2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(color, 0.95);
  ctx.stroke();

  // Truck, scaled to fit the box by its longest side, rotated to the heading.
  const scale = TRUCK_LEN / Math.max(img.width, img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.translate(c, c);
  ctx.rotate((bucket * Math.PI) / 180);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);

  const icon = {
    url: canvas.toDataURL("image/png"),
    scaledSize: new maps.Size(BOX, BOX),
    anchor: new maps.Point(BOX / 2, BOX / 2),
  };
  iconCache.set(key, icon);
  return icon;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
