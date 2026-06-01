import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { createFirstSuperAdminAction } from "@/lib/actions/auth-actions";
import { getProfileCount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const profileCount = await getProfileCount();
  const setupClosed = profileCount > 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imperial Electric</p>
          <CardTitle>First Super Admin</CardTitle>
        </CardHeader>
        <CardContent>
          {setupClosed ? (
            <div className="space-y-4">
              <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                Setup is already complete. New users must be created from the Admin panel.
              </p>
              <Link href="/login" className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-950 bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                Go to Login
              </Link>
            </div>
          ) : (
            <form action={createFirstSuperAdminAction} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" required placeholder="Admin name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" type="email" required placeholder="admin@company.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input name="password" type="password" required minLength={8} />
              </div>
              <Button type="submit" className="w-full">Create Super Admin</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
