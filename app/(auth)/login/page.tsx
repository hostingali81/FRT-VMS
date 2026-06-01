"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { createBrowserSupabaseClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const configured = isSupabaseBrowserConfigured();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!configured) {
      setMessage("Supabase env keys are not configured yet.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imperial Electric</p>
          <CardTitle>FRT-VMS Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input name="password" type="password" required />
            </div>
            {message ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{message}</p> : null}
            <Button type="submit" className="w-full">Sign In</Button>
          </form>
          <div className="mt-4 border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
            First time setup?{" "}
            <Link href="/setup" className="font-semibold text-slate-900 hover:underline">
              Create Super Admin
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
