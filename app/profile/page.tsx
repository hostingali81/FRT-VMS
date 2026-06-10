import { CircleUserRound, KeyRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { PageHeader } from "@/components/shared/PageHeader";
import { updatePasswordAction, updateProfileNameAction } from "@/lib/actions/auth-actions";
import { getSessionUser, requireProfile, ROLE_LABELS } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await requireProfile();
  const user = await getSessionUser();

  return (
    <AppShell profile={profile}>
      <PageHeader title="Profile" eyebrow="Your account" />
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <CircleUserRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <CardTitle>Account details</CardTitle>
            </div>
            <Badge tone="blue">{ROLE_LABELS[profile.role]}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1">
              <Label>Email</Label>
              <p className="break-all text-sm text-slate-600">{user?.email ?? "—"}</p>
            </div>
            <form action={updateProfileNameAction} className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={profile.name} required />
              <div className="pt-1">
                <SubmitButton>Save name</SubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            </span>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updatePasswordAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current_password">Current password</Label>
                <Input
                  id="current_password"
                  name="current_password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password">New password</Label>
                <Input
                  id="new_password"
                  name="new_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm new password</Label>
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
              <p className="text-xs text-slate-500">Use at least 6 characters.</p>
              <SubmitButton>Update password</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
