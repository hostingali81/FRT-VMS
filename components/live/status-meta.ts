import type { LiveStatus } from "@/lib/types";

/**
 * Per-status presentation, mirroring the GPS app's vivid colours.
 *   hex    → donut segment / dot fill
 *   text   → coloured vehicle name + speed on the card
 *   soft   → tinted icon chip (bg + text)
 *   pill   → status chip (bg + text + ring)
 *   dot    → small status dot
 *   accent → solid left-edge accent bar on the card
 */
export const STATUS_META: Record<
  LiveStatus,
  { label: string; hex: string; text: string; soft: string; pill: string; dot: string; accent: string }
> = {
  running: {
    label: "Running",
    hex: "#22c55e",
    text: "text-emerald-600",
    soft: "bg-emerald-50 text-emerald-600",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
    accent: "bg-emerald-500",
  },
  idle: {
    label: "Idle",
    hex: "#f97316",
    text: "text-orange-600",
    soft: "bg-orange-50 text-orange-600",
    pill: "bg-orange-50 text-orange-700 ring-orange-200",
    dot: "bg-orange-500",
    accent: "bg-orange-500",
  },
  stopped: {
    label: "Stopped",
    hex: "#ef4444",
    text: "text-red-600",
    soft: "bg-red-50 text-red-600",
    pill: "bg-red-50 text-red-700 ring-red-200",
    dot: "bg-red-500",
    accent: "bg-red-500",
  },
  inactive: {
    label: "Inactive",
    hex: "#14b8a6",
    text: "text-teal-600",
    soft: "bg-teal-50 text-teal-600",
    pill: "bg-teal-50 text-teal-700 ring-teal-200",
    dot: "bg-teal-500",
    accent: "bg-teal-500",
  },
  noData: {
    label: "No Data",
    hex: "#334155",
    text: "text-slate-700",
    soft: "bg-slate-100 text-slate-700",
    pill: "bg-slate-100 text-slate-700 ring-slate-300",
    dot: "bg-slate-700",
    accent: "bg-slate-600",
  },
  expired: {
    label: "Expired",
    hex: "#8b5cf6",
    text: "text-violet-600",
    soft: "bg-violet-50 text-violet-600",
    pill: "bg-violet-50 text-violet-700 ring-violet-200",
    dot: "bg-violet-500",
    accent: "bg-violet-500",
  },
  expiringSoon: {
    label: "Exp. Soon",
    hex: "#ec4899",
    text: "text-pink-600",
    soft: "bg-pink-50 text-pink-600",
    pill: "bg-pink-50 text-pink-700 ring-pink-200",
    dot: "bg-pink-500",
    accent: "bg-pink-500",
  },
};

/** Display order for the donut (matches the app's ring layout, clockwise from top). */
export const DONUT_ORDER: LiveStatus[] = [
  "idle",
  "noData",
  "running",
  "stopped",
  "inactive",
  "expired",
  "expiringSoon",
];
