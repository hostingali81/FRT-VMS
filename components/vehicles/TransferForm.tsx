"use client";

import { AlertTriangle, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import type { FleetVehicle, LookupData } from "@/lib/types";
import { formatDate } from "@/lib/utils/format";

export function TransferForm({
  vehicle,
  lookups,
  action,
}: {
  vehicle: FleetVehicle;
  lookups: LookupData;
  action: (formData: FormData) => Promise<void>;
}) {
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
            <Input name="transfer_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </Field>
          <Field label="Reason">
            <Select name="reason" defaultValue="Interchange">
              <option>Interchange</option>
              <option>Redeployment</option>
              <option>Breakdown</option>
              <option>Administrative</option>
              <option>Cross-Circle</option>
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
          <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
            {isCrossCircle ? <Badge tone="indigo">Cross-circle</Badge> : <Badge tone="blue">Same circle</Badge>}
            <Button type="submit">
              <Send className="h-4 w-4" aria-hidden="true" />
              Submit Transfer
            </Button>
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

