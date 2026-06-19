"use client";

import { AlertTriangle, Send, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import type { DriverAssignment, FleetVehicle, LookupData } from "@/lib/types";
import { formatDate, titleCase } from "@/lib/utils/format";
import { istToday } from "@/lib/utils/month";

// Reason values are stored as-is in transfer history, so keep them stable.
// `hint` is only shown in the dropdown to make each reason self-explanatory.
// Reasons describe WHY the vehicle moved, not its condition — the vehicle's
// working state ("breakdown", "accident", etc.) lives in Status, not here.
// Same-circle moves are operational (any reason); cross-circle moves are
// administrative redeployments that need approval, so the list is narrower.
// "Cross-circle" is never a manual reason — the form detects it automatically.
const SAME_CIRCLE_REASONS = [
  { value: "Interchange", hint: "swap two vehicles" },
  { value: "Redeployment", hint: "moved where needed" },
  { value: "Administrative", hint: "management decision" },
];

const CROSS_CIRCLE_REASONS = [
  { value: "Redeployment", hint: "moved where needed" },
  { value: "Administrative", hint: "management decision" },
];

export function TransferForm({
  vehicle,
  lookups,
  currentDrivers = [],
  action,
  cancelHref,
}: {
  vehicle: FleetVehicle;
  lookups: LookupData;
  currentDrivers?: DriverAssignment[];
  action: (formData: FormData) => Promise<void>;
  cancelHref?: string;
}) {
  const [moveDriver, setMoveDriver] = useState(false);
  const [circleId, setCircleId] = useState(vehicle.current_circle_id ?? lookups.circles[0]?.id ?? "");
  const [divisionId, setDivisionId] = useState(vehicle.division_id ?? "");

  const divisions = useMemo(
    () => lookups.divisions.filter((division) => division.circle_id === circleId),
    [circleId, lookups.divisions],
  );

  const substations = useMemo(
    () => lookups.substations.filter((substation) => substation.division_id === divisionId),
    [divisionId, lookups.substations],
  );

  const isCrossCircle = Boolean(vehicle.current_circle_id && circleId && vehicle.current_circle_id !== circleId);

  const reasonOptions = isCrossCircle ? CROSS_CIRCLE_REASONS : SAME_CIRCLE_REASONS;
  const [reason, setReason] = useState(SAME_CIRCLE_REASONS[0].value);

  // When the transfer type flips (same- vs cross-circle), the current reason
  // may no longer be offered — fall back to the first valid option.
  useEffect(() => {
    if (!reasonOptions.some((option) => option.value === reason)) {
      setReason(reasonOptions[0].value);
    }
  }, [reasonOptions, reason]);

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <input type="hidden" name="vehicle_id" value={vehicle.vehicle_id} />
      <Card>
        <CardHeader>
          <CardTitle>Current Deployment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <Info label="Vehicle" value={vehicle.registration_no} />
          <Info label="From Circle" value={vehicle.current_circle ?? vehicle.home_circle} />
          <Info label="From Division" value={vehicle.division ?? "Unassigned"} />
          <Info label="From Substation" value={vehicle.substation ?? "Unassigned"} />
          <Info label="Since" value={formatDate(vehicle.assigned_from)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New Deployment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {isCrossCircle ? (
            <div className="md:col-span-2">
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Cross-circle transfer: Zonal Manager or HQ approval is required.</span>
              </div>
            </div>
          ) : null}
          <Field label="Transfer Date">
            <Input name="transfer_date" type="date" defaultValue={istToday()} required />
          </Field>
          <Field label="Reason">
            <Select name="reason" value={reason} onChange={(event) => setReason(event.target.value)}>
              {reasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value} — {option.hint}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To Circle">
            <Select
              name="to_circle_id"
              value={circleId}
              onChange={(event) => {
                setCircleId(event.target.value);
                setDivisionId("");
              }}
              required
            >
              {lookups.circles.map((circle) => (
                <option key={circle.id} value={circle.id}>
                  {circle.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To Division">
            <Select name="to_division_id" value={divisionId} onChange={(event) => setDivisionId(event.target.value)} required>
              <option value="">Select division</option>
              {divisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To Substation">
            <Select name="to_substation_id" disabled={!divisionId} required>
              <option value="">Select substation</option>
              {substations.map((substation) => (
                <option key={substation.id} value={substation.id}>
                  {substation.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Approved By">
            <Input name="approved_by" required placeholder="Approver name" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Remarks">
              <Textarea name="remarks" />
            </Field>
          </div>
          <div className="md:col-span-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Users className="h-4 w-4" aria-hidden="true" />
              Drivers on this vehicle
            </div>
            {currentDrivers.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {currentDrivers.map((driver) => (
                  <li key={driver.id}>
                    {driver.driver_name} — <span className="text-slate-500">{titleCase(driver.shift)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm italic text-slate-400">No drivers currently assigned.</p>
            )}
            {currentDrivers.length > 0 ? (
              <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="move_driver"
                  checked={moveDriver}
                  onChange={(event) => setMoveDriver(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
                <span>
                  Move driver(s) with the vehicle
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {moveDriver
                      ? "Driver(s) will be re-posted to the new substation and keep driving this vehicle."
                      : `Driver(s) will stay posted at ${vehicle.substation ?? "their current substation"} and become available for the next vehicle there.`}
                  </span>
                </span>
              </label>
            ) : null}
          </div>
          <div className="grid gap-3 md:col-span-2 md:flex md:flex-wrap md:items-center md:justify-between">
            {isCrossCircle ? <Badge tone="indigo">Cross-circle</Badge> : <Badge tone="blue">Same circle</Badge>}
            <div className="flex w-full gap-2 md:w-auto">
              {cancelHref ? (
                <LinkButton href={cancelHref} variant="outline" className="flex-1 justify-center md:flex-none">
                  Cancel
                </LinkButton>
              ) : null}
              <SubmitButton className="flex-1 md:flex-none">
                <Send className="h-4 w-4" aria-hidden="true" />
                Save Location
              </SubmitButton>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-950">{value}</p>
    </div>
  );
}
