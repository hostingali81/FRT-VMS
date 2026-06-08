"use client";

import { Save } from "lucide-react";
import { useMemo, useState } from "react";
import { LinkButton } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import type { FleetVehicle, LookupData } from "@/lib/types";

export function VehicleForm({
  lookups,
  action,
  vehicle,
  submitLabel = "Save Vehicle",
  cancelHref,
}: {
  lookups: LookupData;
  action: (formData: FormData) => Promise<void>;
  vehicle?: FleetVehicle;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const [circleId, setCircleId] = useState(vehicle?.home_circle_id ?? lookups.circles[0]?.id ?? "");
  const [divisionId, setDivisionId] = useState(vehicle?.division_id ?? "");

  const divisions = useMemo(
    () => lookups.divisions.filter((division) => division.circle_id === circleId),
    [circleId, lookups.divisions],
  );

  const substations = useMemo(
    () => lookups.substations.filter((substation) => substation.division_id === divisionId),
    [divisionId, lookups.substations],
  );

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      {vehicle ? <input type="hidden" name="vehicle_id" value={vehicle.vehicle_id} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Vehicle Master</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Registration No">
            <Input name="registration_no" placeholder="UP32 AB 1234" defaultValue={vehicle?.registration_no ?? ""} required />
          </Field>
          <Field label="FRT No">
            <Input name="frt_no" placeholder="FRT 1" defaultValue={vehicle?.frt_no ?? ""} />
          </Field>
          <Field label="Vehicle Type">
            <Input name="vehicle_type" placeholder="Bolero" defaultValue={vehicle?.vehicle_type ?? ""} />
          </Field>
          <Field label="Fuel Type">
            <Select name="fuel_type" defaultValue={vehicle?.fuel_type ?? "Diesel"}>
              <option>Diesel</option>
              <option>Petrol</option>
              <option>CNG</option>
              <option>EV</option>
            </Select>
          </Field>
          {!vehicle ? (
            <Field label="Fuel By">
              <Select name="fuel_ownership" defaultValue="company">
                <option value="company">Company Fuel</option>
                <option value="vendor">Vendor Fuel</option>
              </Select>
            </Field>
          ) : null}
          {!vehicle ? (
            <Field label="Driver By">
              <Select name="driver_ownership" defaultValue="company">
                <option value="company">Company Driver</option>
                <option value="vendor">Vendor Driver</option>
              </Select>
            </Field>
          ) : null}
          <Field label="Model Year">
            <Input name="model_year" type="number" min="1990" max="2035" placeholder="2023" defaultValue={vehicle?.model_year ?? ""} />
          </Field>
          <Field label="Owner Name">
            <Input name="owner_name" defaultValue={vehicle?.owner_name ?? ""} />
          </Field>
          <Field label="Owner Mobile">
            <Input name="owner_mobile" inputMode="tel" defaultValue={vehicle?.owner_mobile ?? ""} />
          </Field>
          <Field label="Vendor">
            <Input name="vendor_name" defaultValue={vehicle?.vendor_name ?? ""} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={vehicle?.status ?? "active"} disabled={Boolean(vehicle)}>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="breakdown">Breakdown</option>
              <option value="standby">Standby</option>
              <option value="removed">Removed</option>
              <option value="accident">Accident</option>
            </Select>
          </Field>
          <Field label="GPS Company">
            <Input name="gps_company" defaultValue={vehicle?.gps_company ?? ""} />
          </Field>
          <Field label="GPS Device ID">
            <Input name="gps_device_id" defaultValue={vehicle?.gps_device_id ?? ""} />
          </Field>
          <Field label="Insurance Expiry">
            <Input name="insurance_expiry" type="date" defaultValue={vehicle?.insurance_expiry ?? ""} />
          </Field>
          <Field label="Fitness Expiry">
            <Input name="fitness_expiry" type="date" defaultValue={vehicle?.fitness_expiry ?? ""} />
          </Field>
          <Field label="Pollution Expiry">
            <Input name="pollution_expiry" type="date" defaultValue={vehicle?.pollution_expiry ?? ""} />
          </Field>
          {!vehicle ? (
            <Field label="Assigned From">
              <Input name="assigned_from" type="date" />
            </Field>
          ) : null}
          <div className="md:col-span-2">
            <Field label="Notes">
              <Textarea name="notes" defaultValue={vehicle?.notes ?? ""} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {!vehicle ? (
        <Card>
          <CardHeader>
            <CardTitle>Deployment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Circle">
              <Select
                name="circle_id"
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
            <Field label="Division">
              <Select name="division_id" value={divisionId} onChange={(event) => setDivisionId(event.target.value)}>
                <option value="">Unassigned</option>
                {divisions.map((division) => (
                  <option key={division.id} value={division.id}>
                    {division.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Substation">
              <Select name="substation_id" disabled={!divisionId}>
                <option value="">Unassigned</option>
                {substations.map((substation) => (
                  <option key={substation.id} value={substation.id}>
                    {substation.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assigned By">
              <Input name="assigned_by" placeholder="Name / role" />
            </Field>
            <div className="grid gap-2">
              <SubmitButton className="w-full">
                <Save className="h-4 w-4" aria-hidden="true" />
                {submitLabel}
              </SubmitButton>
              {cancelHref ? (
                <LinkButton href={cancelHref} variant="outline" className="w-full justify-center">
                  Cancel
                </LinkButton>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Current Deployment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p>
              <p className="mt-1 font-medium text-slate-950">
                {vehicle.current_circle ?? vehicle.home_circle} / {vehicle.division ?? "Unassigned"} / {vehicle.substation ?? "Unassigned"}
              </p>
            </div>
            <p className="text-slate-500">Use Change Location to change circle, division, or substation.</p>
            <div className="grid gap-2">
              <SubmitButton className="w-full">
                <Save className="h-4 w-4" aria-hidden="true" />
                {submitLabel}
              </SubmitButton>
              {cancelHref ? (
                <LinkButton href={cancelHref} variant="outline" className="w-full justify-center">
                  Cancel
                </LinkButton>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
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
