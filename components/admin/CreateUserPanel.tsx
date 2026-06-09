"use client";

import { Plus, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { DashedButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { RoleScopeFields } from "@/components/admin/RoleScopeFields";
import type { LookupData } from "@/lib/types";

export function CreateUserPanel({
  lookups,
  action,
}: {
  lookups: LookupData;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <DashedButton type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Create New User
      </DashedButton>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            </span>
            <CardTitle>Create User</CardTitle>
          </div>
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
        <form action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Name">
            <Input name="name" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Temporary Password">
            <Input name="password" type="password" required minLength={6} />
          </Field>
          <RoleScopeFields lookups={lookups} defaultRole="viewer" />
          <div className="flex items-end">
            <SubmitButton className="w-full">Create User</SubmitButton>
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
