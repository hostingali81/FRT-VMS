"use client";

import { AlertCircle, Gauge, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";

type VehicleOption = {
  vehicle_id: string;
  registration_no: string;
  frt_no: string | null;
  substation: string | null;
  gps_company: string | null;
};

// Matches getVehicleGpsDistanceAction's return shape without importing the
// server module into the client bundle.
type CalcAction = (input: {
  vehicleId: string;
  fromISO: string;
  toISO: string;
}) => Promise<{ ok: true; km: number; registration: string } | { ok: false; error: string }>;

type Result = { km: number; registration: string; fromLabel: string; toLabel: string };

const pad = (n: number) => String(n).padStart(2, "0");

// A Date → the "YYYY-MM-DDTHH:mm" string a <input type="datetime-local"> expects,
// in the device's local time.
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

export function GpsDistanceCalculator({
  vehicles,
  action,
}: {
  vehicles: VehicleOption[];
  action: CalcAction;
}) {
  // The searchable Select falls back to the first option when its value isn't a
  // known option, so seed state with the first vehicle to keep UI and state in
  // sync (rather than a placeholder that never actually shows).
  const [vehicleId, setVehicleId] = useState(() => vehicles[0]?.vehicle_id ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Default to "today, so far". Set on the client to avoid an SSR hydration
  // mismatch (the server has no local clock for the device).
  useEffect(() => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    setFrom(toLocalInput(startOfDay));
    setTo(toLocalInput(now));
  }, []);

  // On mobile the result lands below the fold, so bring it into view as soon
  // as it appears.
  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [result]);

  async function handleCalculate() {
    setError("");
    setResult(null);

    if (!vehicleId) {
      setError("Pehle vehicle chuno.");
      return;
    }
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

    setLoading(true);
    const res = await action({
      vehicleId,
      fromISO: fromDate.toISOString(),
      toISO: toDate.toISOString(),
    });
    setLoading(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult({
      km: res.km,
      registration: res.registration,
      fromLabel: prettyLocal(from),
      toLabel: prettyLocal(to),
    });
  }

  if (vehicles.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm font-medium text-slate-600">Koi GPS-mapped vehicle nahi mila</p>
          <p className="mt-1 text-xs text-slate-400">
            Distance sirf un vehicles ka nikalta hai jinpe GPS device laga ho.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicle</Label>
            <Select
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
              placeholder="Vehicle chuno…"
              disabled={loading}
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                  {vehicle.registration_no}
                  {vehicle.frt_no ? ` · ${vehicle.frt_no}` : ""}
                  {vehicle.substation ? ` · ${vehicle.substation}` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gps-from">Start date &amp; time</Label>
            <Input
              id="gps-from"
              type="datetime-local"
              value={from}
              max={to || undefined}
              disabled={loading}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gps-to">End date &amp; time</Label>
            <Input
              id="gps-to"
              type="datetime-local"
              value={to}
              min={from || undefined}
              disabled={loading}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>

          {error ? (
            <p className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <Button type="button" className="w-full" onClick={handleCalculate} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Gauge className="h-4 w-4" aria-hidden="true" />
            )}
            {loading ? "Calculating…" : "Calculate Distance"}
          </Button>
        </CardContent>
      </Card>

      {result ? (
        <div ref={resultRef} className="scroll-mt-4">
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Distance travelled</p>
              <p className="mt-2 text-4xl font-bold text-slate-950">
                {result.km.toLocaleString("en-IN")} <span className="text-2xl font-semibold text-slate-500">km</span>
              </p>
              <p className="mt-3 text-sm font-medium text-slate-700">{result.registration}</p>
              <p className="mt-1 text-xs text-slate-500">
                {result.fromLabel} — {result.toLabel}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
