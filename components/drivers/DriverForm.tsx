"use client";

import { Plus, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { DashedButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import type { LookupData } from "@/lib/types";

export function DriverForm({
  lookups,
  action,
}: {
  lookups: LookupData;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [circleId, setCircleId] = useState(lookups.circles[0]?.id ?? "");
  const [divisionId, setDivisionId] = useState("");

  const divisions = useMemo(
    () => lookups.divisions.filter((division) => division.circle_id === circleId),
    [circleId, lookups.divisions],
  );
  const substations = useMemo(
    () => lookups.substations.filter((substation) => substation.division_id === divisionId),
    [divisionId, lookups.substations],
  );

  if (!open) {
    return (
      <DashedButton type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add New Driver
      </DashedButton>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Add Driver</CardTitle>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Field label="Name">
            <Input name="name" required />
          </Field>
          <Field label="Mobile">
            <Input name="mobile" inputMode="tel" />
          </Field>
          <Field label="License No">
            <Input name="license_no" />
          </Field>
          <Field label="License Expiry">
            <Input name="license_expiry" type="date" />
          </Field>
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
            <Select name="division_id" value={divisionId} onChange={(event) => setDivisionId(event.target.value)} required>
              <option value="">Select division</option>
              {divisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Substation">
            <Select name="substation_id" disabled={!divisionId} required>
              <option value="">Select substation</option>
              {substations.map((substation) => (
                <option key={substation.id} value={substation.id}>
                  {substation.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue="active">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
          <div className="md:col-span-2 xl:col-span-5">
            <Field label="Address">
              <Textarea name="address" />
            </Field>
          </div>
          <div className="flex items-end">
            <SubmitButton className="w-full">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save Driver
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
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
