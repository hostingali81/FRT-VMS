import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Driver</CardTitle>
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
            <Select name="circle_id" required>
              {lookups.circles.map((circle) => (
                <option key={circle.id} value={circle.id}>
                  {circle.name}
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
            <Button type="submit" className="w-full">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save Driver
            </Button>
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

