import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/shared/PageHeader";
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
import type { AdminUserRow, UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profile = await requireRole(["super_admin"]);
  const [lookups, users] = await Promise.all([getLookups(profile), getAdminUsers()]);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Admin" eyebrow="Users, roles and master data" />
      <div className="grid gap-4 px-4 py-5 sm:px-6 lg:px-8 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Master Counts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Count label="Zones" value={lookups.zones?.length ?? 0} />
            <Count label="Circles" value={lookups.circles.length} />
            <Count label="Divisions" value={lookups.divisions.length} />
            <Count label="Substations" value={lookups.substations.length} />
            <Count label="Users" value={users.length} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Create User</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createUserAction} className="grid gap-4 md:grid-cols-2">
              <Field label="Name">
                <Input name="name" required placeholder="User name" />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" required placeholder="user@company.com" />
              </Field>
              <Field label="Temporary Password">
                <Input name="password" type="password" required minLength={8} />
              </Field>
              <Field label="Role">
                <Select name="role" defaultValue="viewer" required>
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Zone">
                <Select name="zone_id">
                  <option value="">No zone</option>
                  {lookups.zones?.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Circle">
                <Select name="circle_id">
                  <option value="">No circle</option>
                  {lookups.circles.map((circle) => (
                    <option key={circle.id} value={circle.id}>
                      {circle.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Division">
                <Select name="division_id">
                  <option value="">No division</option>
                  {lookups.divisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <Button type="submit" className="w-full">Create User</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {users.map((user) => (
              <UserEditor key={user.id} user={user} lookups={lookups} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createZoneAction} className="space-y-3">
              <Field label="Zone Name">
                <Input name="name" required placeholder="Central UP" />
              </Field>
              <Button type="submit" className="w-full">Add Zone</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Circle</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createCircleAction} className="space-y-3">
              <Field label="Circle Name">
                <Input name="name" required placeholder="Lucknow" />
              </Field>
              <Field label="Zone">
                <Select name="zone_id">
                  <option value="">No zone</option>
                  {lookups.zones?.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="State">
                <Input name="state" defaultValue="Uttar Pradesh" />
              </Field>
              <Field label="DISCOM">
                <Input name="discom" defaultValue="MVVNL" />
              </Field>
              <Field label="Contract Ref">
                <Input name="contract_ref" />
              </Field>
              <Button type="submit" className="w-full">Add Circle</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Division</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createDivisionAction} className="space-y-3">
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
              <Button type="submit" className="w-full">Add Division</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Add Substation</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createSubstationAction} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
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
              <div className="flex items-end">
                <Button type="submit" className="w-full md:w-auto">Add Substation</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function UserEditor({ user, lookups }: { user: AdminUserRow; lookups: Awaited<ReturnType<typeof getLookups>> }) {
  return (
    <form action={updateUserProfileAction} className="grid gap-3 rounded-lg border border-slate-200 p-3 lg:grid-cols-[1.2fr_1.2fr_1fr_1fr_1fr_1fr_0.8fr_auto]">
      <input type="hidden" name="user_id" value={user.id} />
      <Field label="Name">
        <Input name="name" defaultValue={user.name} required />
      </Field>
      <div className="space-y-2">
        <Label>Email</Label>
        <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
          {user.email ?? "No email"}
        </div>
      </div>
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
          {lookups.zones?.map((zone) => (
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
        <Button type="submit" variant="secondary" className="w-full">Update</Button>
      </div>
      <div className="lg:col-span-8 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge tone={user.is_active ? "green" : "gray"}>{user.is_active ? "Active" : "Disabled"}</Badge>
        <span>Last sign-in: {formatDateTime(user.last_sign_in_at)}</span>
      </div>
    </form>
  );
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
