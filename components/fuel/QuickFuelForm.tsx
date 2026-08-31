"use client";

import { useState } from "react";
import { Check, Fuel, Save, X } from "lucide-react";
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

/** An existing fill being corrected — turns the form into edit mode. */
export type FuelLogDraft = {
  id: string;
  vehicle_id: string;
  log_date: string;
  logged_at: string | null;
  fuel_type: string | null;
  fuel_litres: number;
  fuel_amount: number | null;
  notes: string | null;
};

const FUEL_TYPES = ["Diesel", "Petrol", "CNG"] as const;
type FuelType = (typeof FUEL_TYPES)[number];

function normalizeFuelType(value: string | null | undefined): FuelType {
  return (FUEL_TYPES as readonly string[]).includes(value ?? "") ? (value as FuelType) : "Diesel";
}

const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/** Split a stored instant back into the IST hour / minute / AM-PM the form uses. */
function istTimeParts(iso: string | null | undefined) {
  const blank = { hour: "", minute: "00", ampm: "AM" };
  if (!iso) return blank;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return blank;
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    hour: String(Number(get("hour") || "0")),
    minute: get("minute") || "00",
    ampm: (get("dayPeriod") || "AM").toUpperCase().replace(/\./g, ""),
  };
}

export function QuickFuelForm({
  vehicles,
  action,
  today,
  returnTo = "add",
  returnQuery,
  locked = false,
  entry,
  onCancel,
}: {
  vehicles: VehicleOption[];
  action: (formData: FormData) => Promise<void>;
  today: string;
  /** Value for the hidden return_to field — "add" returns to /fuel-log/add, otherwise back to the vehicle profile. */
  returnTo?: string;
  /** Filter/page query the action should re-apply on redirect, so correcting an
   *  entry returns to the same filtered list instead of an unfiltered page 1. */
  returnQuery?: string;
  /** When true the vehicle is fixed (vehicles[0]) and shown as a label instead of a dropdown. */
  locked?: boolean;
  /** Present → editing this fill instead of adding a new one. */
  entry?: FuelLogDraft;
  /** Edit mode only — renders a Cancel button next to Save. */
  onCancel?: () => void;
}) {
  const isEdit = Boolean(entry);
  const lockedVehicle = locked ? vehicles[0] : undefined;
  const [vehicleId, setVehicleId] = useState(entry?.vehicle_id ?? lockedVehicle?.vehicle_id ?? "");
  const [fuelType, setFuelType] = useState<FuelType>(
    normalizeFuelType(entry?.fuel_type ?? lockedVehicle?.fuel_type),
  );

  // Date is never pre-filled when adding — the user has to pick the fill date, so
  // a mis-remembered "today" can't slip in unnoticed. Editing starts on the saved date.
  const [logDate, setLogDate] = useState(entry?.log_date ?? "");

  // Custom 12-hour time picker — the native <input type="time"> shows 24-hour
  // (no AM/PM) on many devices. Hour blank → no time sent (stays optional).
  const initialTime = istTimeParts(entry?.logged_at);
  const [hour, setHour] = useState(initialTime.hour);
  const [minute, setMinute] = useState(initialTime.minute);
  const [ampm, setAmpm] = useState(initialTime.ampm);
  const logTime = (() => {
    if (!hour) return "";
    let h = parseInt(hour, 10);
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${minute}`;
  })();

  // A saved fill can hold any minute (e.g. 07); keep it selectable alongside the steps.
  const minuteOptions = MINUTE_STEPS.includes(minute)
    ? MINUTE_STEPS
    : [...MINUTE_STEPS, minute].sort((a, b) => Number(a) - Number(b));

  const selectedVehicle = vehicles.find((v) => v.vehicle_id === vehicleId);
  const missingDate = !logDate;
  const missingVehicle = !locked && !vehicleId;

  // No future fills. An entry saved before that rule existed can still sit in the
  // future — don't lock its own date out, or the row becomes uncorrectable.
  const maxDate = entry && entry.log_date > today ? entry.log_date : today;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="return_to" value={returnTo} />
      {returnQuery ? <input type="hidden" name="return_query" value={returnQuery} /> : null}
      <input type="hidden" name="fuel_type" value={fuelType} />
      {entry && <input type="hidden" name="log_id" value={entry.id} />}

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
          <Label className="text-base">
            Date <span className="font-normal text-slate-400">(required)</span>
          </Label>
          <Input
            name="log_date"
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            max={maxDate}
            required
            aria-invalid={missingDate}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-base">
            Approx Time <span className="font-normal text-slate-400">(optional)</span>
          </Label>
          <div className="flex items-center gap-1.5">
            <Select value={hour} onChange={(e) => setHour(e.target.value)} className="h-12 flex-1 text-base" aria-label="Hour">
              <option value="">Hr</option>
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </Select>
            <span className="text-lg font-semibold text-slate-400">:</span>
            <Select value={minute} onChange={(e) => setMinute(e.target.value)} className="h-12 flex-1 text-base" aria-label="Minute">
              {minuteOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
            <Select value={ampm} onChange={(e) => setAmpm(e.target.value)} className="h-12 flex-1 text-base" aria-label="AM or PM">
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
            defaultValue={entry ? String(entry.fuel_litres) : undefined}
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
            defaultValue={entry?.fuel_amount != null ? String(entry.fuel_amount) : undefined}
            // A row already stored without an amount stays correctable without
            // having to invent one; new entries still must carry a cost.
            required={!isEdit || entry?.fuel_amount != null}
            className="h-12 text-base"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-base">
          Notes <span className="font-normal text-slate-400">(optional)</span>
        </Label>
        <Input
          name="notes"
          placeholder="Koi remark ho to…"
          defaultValue={entry?.notes ?? undefined}
          className="h-12 text-base"
        />
      </div>

      <div className={cn("flex gap-2", isEdit && onCancel ? "flex-col sm:flex-row" : "")}>
        <SubmitButton
          className="h-12 w-full text-base"
          disabled={missingDate || missingVehicle}
          title={missingDate ? "Select a date to continue" : undefined}
        >
          {isEdit ? <Save className="h-5 w-5" aria-hidden="true" /> : <Fuel className="h-5 w-5" aria-hidden="true" />}
          {isEdit ? "Update Entry" : "Save Fuel Entry"}
        </SubmitButton>
        {isEdit && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Cancel
          </button>
        )}
      </div>

      {!isEdit && (
        <p className="text-center text-xs text-slate-500">
          KM aur average GPS sync ke baad apne aap aa jayega.
        </p>
      )}
    </form>
  );
}
