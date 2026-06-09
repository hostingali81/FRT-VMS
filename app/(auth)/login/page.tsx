"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { createBrowserSupabaseClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const configured = isSupabaseBrowserConfigured();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    if (!configured) {
      setMessage("Supabase env keys are not configured yet.");
      setIsLoading(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    // Land on "/" so the root route can send each role to its default page
    // (division_incharge → /fuel, everyone else → /dashboard).
    router.push("/");
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
              <Input name="email" type="email" required disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input name="password" type="password" required disabled={isLoading} />
            </div>
            {message ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{message}</p> : null}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
