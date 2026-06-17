"use client";

import { useState } from "react";
import { Check, Fuel } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils/cn";

type VehicleOption = {
  vehicle_id: string;
  registration_no: string;
  frt_no: string | null;
  substation: string | null;
  division: string | null;
  fuel_type: string | null;
};

const FUEL_TYPES = ["Diesel", "Petrol", "CNG"] as const;
type FuelType = (typeof FUEL_TYPES)[number];

function normalizeFuelType(value: string | null | undefined): FuelType {
  return (FUEL_TYPES as readonly string[]).includes(value ?? "") ? (value as FuelType) : "Diesel";
}

export function QuickFuelForm({
  vehicles,
  action,
  today,
  returnTo = "add",
  locked = false,
}: {
  vehicles: VehicleOption[];
  action: (formData: FormData) => Promise<void>;
  today: string;
  /** Value for the hidden return_to field — "add" returns to /fuel-log/add, otherwise back to the vehicle profile. */
  returnTo?: string;
  /** When true the vehicle is fixed (vehicles[0]) and shown as a label instead of a dropdown. */
  locked?: boolean;
}) {
  const lockedVehicle = locked ? vehicles[0] : undefined;
  const [vehicleId, setVehicleId] = useState(lockedVehicle?.vehicle_id ?? "");
  const [fuelType, setFuelType] = useState<FuelType>(normalizeFuelType(lockedVehicle?.fuel_type));

  // Custom 12-hour time picker — the native <input type="time"> shows 24-hour
  // (no AM/PM) on many devices. Hour blank → no time sent (stays optional).
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmpm] = useState("AM");
  const logTime = (() => {
    if (!hour) return "";
    let h = parseInt(hour, 10);
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${minute}`;
  })();

  const selectedVehicle = vehicles.find((v) => v.vehicle_id === vehicleId);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="fuel_type" value={fuelType} />

      {/* Vehicle — locked shows a label, otherwise a dropdown that auto-sets fuel type */}
      {lockedVehicle ? (
        <input type="hidden" name="vehicle_id" value={lockedVehicle.vehicle_id} />
      ) : (
        <div className="space-y-1.5">
          <Label className="text-base">Vehicle</Label>
          <Select
            name="vehicle_id"
            required
            value={vehicleId}
            onChange={(e) => {
              const id = e.target.value;
              setVehicleId(id);
              const v = vehicles.find((veh) => veh.vehicle_id === id);
              setFuelType(normalizeFuelType(v?.fuel_type));
            }}
            className="h-12 text-base"
          >
            <option value="" disabled>
              Vehicle chuno…
            </option>
            {vehicles.map((v) => {
              const suffix = [v.frt_no, v.substation].filter(Boolean).join(" ");
              return (
                <option key={v.vehicle_id} value={v.vehicle_id}>
                  {v.registration_no}
                  {suffix ? ` - ${suffix}` : ""}
                </option>
              );
            })}
          </Select>
        </div>
      )}

      {/* Fuel type — big segmented buttons, selected one clearly highlighted */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-base">Fuel Type</Label>
          <span className="text-xs font-medium text-slate-500">
            Selected: <span className="font-semibold text-slate-900">{fuelType}</span>
            {selectedVehicle && normalizeFuelType(selectedVehicle.fuel_type) === fuelType ? " (vehicle default)" : ""}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {FUEL_TYPES.map((t) => {
            const active = fuelType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setFuelType(t)}
                aria-pressed={active}
                className={cn(
                  "flex h-12 items-center justify-center gap-1.5 rounded-md border-2 text-sm font-semibold transition-colors",
                  active
                    ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {active && <Check className="h-4 w-4" aria-hidden="true" />}
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date + approximate time. Time is optional but makes the mileage more
          accurate (GPS distance is measured between the two fills' exact times). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-base">Date</Label>
          <Input name="log_date" type="date" defaultValue={today} required className="h-12 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-base">
            Approx Time <span className="font-normal text-slate-400">(optional)</span>
          </Label>
          <div className="grid grid-cols-3 gap-2">
            <Select value={hour} onChange={(e) => setHour(e.target.value)} className="h-12 text-base" aria-label="Hour">
              <option value="">Hr</option>
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </Select>
            <Select value={minute} onChange={(e) => setMinute(e.target.value)} className="h-12 text-base" aria-label="Minute">
              {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")).map((m) => (
                <option key={m} value={m}>:{m}</option>
              ))}
            </Select>
            <Select value={ampm} onChange={(e) => setAmpm(e.target.value)} className="h-12 text-base" aria-label="AM or PM">
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </Select>
          </div>
          <input type="hidden" name="log_time" value={logTime} />
          <p className="text-xs text-slate-400">Time daloge to mileage zyada accurate aayega.</p>
        </div>
      </div>

      {/* Litres + Amount */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-base">Fuel Filled (Litres)</Label>
          <Input
            name="fuel_litres"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="e.g. 40"
            required
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-base">Amount Paid (₹)</Label>
          <Input
            name="fuel_amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="e.g. 3600"
            required
            className="h-12 text-base"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-base">
          Notes <span className="font-normal text-slate-400">(optional)</span>
        </Label>
        <Input name="notes" placeholder="Koi remark ho to…" className="h-12 text-base" />
      </div>

      <SubmitButton className="h-12 w-full text-base">
        <Fuel className="h-5 w-5" aria-hidden="true" />
        Save Fuel Entry
      </SubmitButton>

      <p className="text-center text-xs text-slate-500">
        KM aur average GPS sync ke baad apne aap aa jayega.
      </p>
    </form>
  );
}
