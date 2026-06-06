import { Building2, ChevronDown, UsersRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/shared/PageHeader";
import { CreateUserPanel } from "@/components/admin/CreateUserPanel";
import {
  createCircleAction,
  createDivisionAction,
  createSubstationAction,
  createUserAction,
  createZoneAction,
  updateUserProfileAction,
} from "@/lib/actions/admin-actions";
import { requireRole, ROLE_LABELS } from "@/lib/auth";
import { getAdminUsers, getLookups } from "@/lib/data";
import { formatDateTime } from "@/lib/utils/format";
import type { AdminUserRow, LookupData, UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profile = await requireRole(["super_admin"]);
  const [lookups, users] = await Promise.all([getLookups(profile), getAdminUsers()]);

  const counts = [
    { label: "Zones", value: lookups.zones?.length ?? 0 },
    { label: "Circles", value: lookups.circles.length },
    { label: "Divisions", value: lookups.divisions.length },
    { label: "Substations", value: lookups.substations.length },
    { label: "Users", value: users.length },
  ];

  return (
    <AppShell profile={profile}>
      <PageHeader title="Admin" eyebrow="User and master setup" />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
          <MasterCounts counts={counts} />
          <CreateUserPanel lookups={lookups} action={createUserAction} />
        </div>

        <UserList users={users} lookups={lookups} />
        <MasterSetup lookups={lookups} />
      </div>
    </AppShell>
  );
}

function MasterCounts({ counts }: { counts: Array<{ label: string; value: number }> }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Building2 className="h-4 w-4" aria-hidden="true" />
        </span>
        <CardTitle>Master Counts</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {counts.map((item) => (
          <Count key={item.label} label={item.label} value={item.value} />
        ))}
      </CardContent>
    </Card>
  );
}


function UserList({ users, lookups }: { users: AdminUserRow[]; lookups: LookupData }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
          </span>
          <CardTitle>Users</CardTitle>
        </div>
        <Badge tone="gray">{users.length}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        {users.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No users found.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((user) => (
              <UserEditor key={user.id} user={user} lookups={lookups} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UserEditor({ user, lookups }: { user: AdminUserRow; lookups: LookupData }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-col gap-3 px-4 py-4 hover:bg-slate-50 sm:flex-row sm:flex-wrap sm:items-center sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-950">{user.name}</p>
          <p className="mt-1 break-all text-sm text-slate-500">{user.email ?? "No email"}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Badge tone="blue">{ROLE_LABELS[user.role]}</Badge>
          <Badge tone={user.is_active ? "green" : "gray"}>{user.is_active ? "Active" : "Disabled"}</Badge>
          <span className="text-sm text-slate-600">{userScope(user, lookups)}</span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
        </div>
      </summary>
      <form action={updateUserProfileAction} className="grid gap-4 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:px-5 md:grid-cols-2 xl:grid-cols-4">
        <input type="hidden" name="user_id" value={user.id} />
        <Field label="Name">
          <Input name="name" defaultValue={user.name} required />
        </Field>
        <Field label="Role">
          <Select name="role" defaultValue={user.role}>
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Zone">
          <Select name="zone_id" defaultValue={user.zone_id ?? ""}>
            <option value="">No zone</option>
            {(lookups.zones ?? []).map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Circle">
          <Select name="circle_id" defaultValue={user.circle_id ?? ""}>
            <option value="">No circle</option>
            {lookups.circles.map((circle) => (
              <option key={circle.id} value={circle.id}>
                {circle.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Division">
          <Select name="division_id" defaultValue={user.division_id ?? ""}>
            <option value="">No division</option>
            {lookups.divisions.map((division) => (
              <option key={division.id} value={division.id}>
                {division.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Active">
          <Select name="is_active" defaultValue={String(user.is_active)}>
            <option value="true">Active</option>
            <option value="false">Disabled</option>
          </Select>
        </Field>
        <div className="flex items-end">
          <SubmitButton variant="secondary" className="w-full">Update</SubmitButton>
        </div>
        <div className="flex items-end text-sm text-slate-500">
          Last sign-in: {formatDateTime(user.last_sign_in_at)}
        </div>
      </form>
    </details>
  );
}

function MasterSetup({ lookups }: { lookups: LookupData }) {
  return (
    <details className="group rounded-lg border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-slate-950">Master Setup</h2>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-4 border-t border-slate-100 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4">
        <form action={createZoneAction} className="space-y-3 rounded-md border border-slate-200 p-4">
          <Field label="Zone Name">
            <Input name="name" required />
          </Field>
          <SubmitButton variant="secondary" className="w-full">Add Zone</SubmitButton>
        </form>

        <form action={createCircleAction} className="space-y-3 rounded-md border border-slate-200 p-4">
          <Field label="Circle Name">
            <Input name="name" required />
          </Field>
          <Field label="Zone">
            <Select name="zone_id">
              <option value="">No zone</option>
              {(lookups.zones ?? []).map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </Select>
          </Field>
          <SubmitButton variant="secondary" className="w-full">Add Circle</SubmitButton>
        </form>

        <form action={createDivisionAction} className="space-y-3 rounded-md border border-slate-200 p-4">
          <Field label="Division Name">
            <Input name="name" required />
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
          <SubmitButton variant="secondary" className="w-full">Add Division</SubmitButton>
        </form>

        <form action={createSubstationAction} className="space-y-3 rounded-md border border-slate-200 p-4">
          <Field label="Substation Name">
            <Input name="name" required />
          </Field>
          <Field label="Division">
            <Select name="division_id" required>
              {lookups.divisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </Select>
          </Field>
          <SubmitButton variant="secondary" className="w-full">Add Substation</SubmitButton>
        </form>
      </div>
    </details>
  );
}

function userScope(user: AdminUserRow, lookups: LookupData) {
  const division = lookups.divisions.find((item) => item.id === user.division_id);
  if (division) return division.name;

  const circle = lookups.circles.find((item) => item.id === user.circle_id);
  if (circle) return circle.name;

  const zone = lookups.zones?.find((item) => item.id === user.zone_id);
  if (zone) return zone.name;

  return "All access";
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-lg font-semibold text-slate-950">{value}</span>
    </div>
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
