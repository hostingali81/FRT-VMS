"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  History,
  Loader2,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import { Input, Label } from "@/components/ui/form";
import { cn } from "@/lib/utils/cn";

export type RouteRange = { fromISO: string; toISO: string; label: string };

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

// Calendar parts of "now" as seen in IST, regardless of the device's timezone.
function istParts(d = new Date()) {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return { y: ist.getUTCFullYear(), m: ist.getUTCMonth(), d: ist.getUTCDate() };
}
// The UTC instant of IST-midnight for a given IST calendar date.
function istMidnight(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
}

type PresetKey = "today" | "yesterday" | "thisMonth" | "lastMonth";

function presetRange(key: PresetKey): RouteRange {
  const now = new Date();
  const { y, m, d } = istParts(now);

  switch (key) {
    case "today":
      return { fromISO: istMidnight(y, m, d).toISOString(), toISO: now.toISOString(), label: "Today" };
    case "yesterday":
      return {
        fromISO: istMidnight(y, m, d - 1).toISOString(),
        toISO: istMidnight(y, m, d).toISOString(),
        label: "Yesterday",
      };
    case "thisMonth":
      return { fromISO: istMidnight(y, m, 1).toISOString(), toISO: now.toISOString(), label: "This month" };
    case "lastMonth":
      return {
        fromISO: istMidnight(y, m - 1, 1).toISOString(),
        toISO: istMidnight(y, m, 1).toISOString(),
        label: "Last month",
      };
  }
}

// Custom range uses the same plain datetime-local approach as the /gps-distance
// page: read in the device's local clock (IST for these users).
// A Date → the "YYYY-MM-DDTHH:mm" string a <input type="datetime-local"> expects.
function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function prettyLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Default custom window: "today, so far" — start of day → now, local clock.
function defaultLocal(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { from: toLocalInput(start), to: toLocalInput(now) };
}

const PRESETS: { key: PresetKey; label: string; hint: string; icon: typeof CalendarDays; tint: string }[] = [
  { key: "today", label: "Today", hint: "Midnight se abhi tak", icon: CalendarDays, tint: "bg-blue-50 text-blue-600" },
  { key: "yesterday", label: "Yesterday", hint: "Poora pichla din", icon: History, tint: "bg-violet-50 text-violet-600" },
  { key: "thisMonth", label: "This month", hint: "1st se abhi tak", icon: CalendarRange, tint: "bg-emerald-50 text-emerald-600" },
  { key: "lastMonth", label: "Last month", hint: "Pichla poora mahina", icon: Sun, tint: "bg-amber-50 text-amber-600" },
];

export function RangeSheet({
  open,
  loading,
  onClose,
  onSelect,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSelect: (range: RouteRange) => void;
}) {
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");

  // Seed the custom pickers on the client so SSR/hydration agree (local clock).
  useEffect(() => {
    if (open) {
      const def = defaultLocal();
      setFrom((f) => f || def.from);
      setTo((t) => t || def.to);
    } else {
      // Reset to the preset list the next time it opens.
      setCustom(false);
      setError("");
    }
  }, [open]);

  // Lock background scroll + close on Escape while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  function pickCustom() {
    setError("");
    if (!from || !to) {
      setError("Start aur end date-time dono chuno.");
      return;
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      setError("Date-time sahi nahi hai.");
      return;
    }
    if (fromDate.getTime() >= toDate.getTime()) {
      setError("Start date-time, end se pehle hona chahiye.");
      return;
    }
    onSelect({
      fromISO: fromDate.toISOString(),
      toISO: toDate.toISOString(),
      label: `${prettyLocal(from)} – ${prettyLocal(to)}`,
    });
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] flex items-end justify-center transition-opacity duration-300",
        open ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Route history range"
        className={cn(
          "relative w-full max-w-lg rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 ease-out",
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-slate-300" aria-hidden="true" />
        </div>

        <div className="px-5 pb-2 pt-3">
          <h2 className="text-base font-semibold text-slate-950">Route history</h2>
          <p className="mt-0.5 text-xs text-slate-500">Kis duration ka route dekhna hai?</p>
        </div>

        {!custom ? (
          <div className="px-3 pb-3">
            <ul className="space-y-1">
              {PRESETS.map(({ key, label, hint, icon: Icon, tint }) => (
                <li key={key}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onSelect(presetRange(key))}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:scale-[0.98] hover:bg-slate-50 disabled:opacity-60"
                  >
                    <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", tint)}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{label}</span>
                      <span className="block truncate text-xs text-slate-500">{hint}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setCustom(true)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:scale-[0.98] hover:bg-slate-50 disabled:opacity-60"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600">
                    <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">Custom</span>
                    <span className="block truncate text-xs text-slate-500">Apni date &amp; time range chuno</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
                </button>
              </li>
            </ul>
          </div>
        ) : (
          <div className="space-y-3 px-5 pb-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="route-from">Start date &amp; time</Label>
              <Input
                id="route-from"
                type="datetime-local"
                value={from}
                max={to || undefined}
                disabled={loading}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="route-to">End date &amp; time</Label>
              <Input
                id="route-to"
                type="datetime-local"
                value={to}
                min={from || undefined}
                disabled={loading}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>

            {error ? (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            ) : null}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={loading}
                onClick={() => setCustom(false)}
                className="h-12 flex-1 rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700 transition active:scale-[0.98] hover:bg-slate-200 disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={pickCustom}
                className="inline-flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-semibold text-white transition active:scale-[0.98] hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Show route
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
