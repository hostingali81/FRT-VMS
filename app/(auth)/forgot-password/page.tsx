"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { requestPasswordResetAction } from "@/lib/actions/auth-actions";
import { createBrowserSupabaseClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";

type Step = "request" | "verify";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const configured = isSupabaseBrowserConfigured();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Seconds left before "Resend code" is allowed again. Set to 60 each time a
  // code is sent so the user can't spam the email endpoint.
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function notify(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  // Step 1 — email a recovery OTP code. The server action first checks the email
  // belongs to a real account, so we can tell the user when it doesn't.
  async function handleRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    notify("");
    if (!configured) {
      notify("Supabase env keys are not configured yet.", true);
      return;
    }

    setIsLoading(true);
    const result = await requestPasswordResetAction(email);
    setIsLoading(false);

    if (result.status === "not-found") {
      notify("No account is registered with this email address. Please check the email and try again.", true);
      return;
    }
    if (result.status === "invalid") {
      notify("Please enter your email address.", true);
      return;
    }
    if (result.status !== "sent") {
      notify("Something went wrong while sending the code. Please try again.", true);
      return;
    }

    setStep("verify");
    setCooldown(60);
    notify(`A 6-digit reset code has been sent to ${email.trim()}. Enter it below.`);
  }

  // Step 2 — verify the OTP (which signs the user in under a recovery session)
  // and immediately set the new password.
  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    notify("");

    if (password.length < 6) {
      notify("Password must be at least 6 characters.", true);
      return;
    }
    if (password !== confirm) {
      notify("Passwords do not match.", true);
      return;
    }

    setIsLoading(true);
    const supabase = createBrowserSupabaseClient();

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "recovery",
    });
    if (verifyError) {
      setIsLoading(false);
      notify("Invalid or expired code. Please check the code or request a new one.", true);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (updateError) {
      notify(updateError.message, true);
      return;
    }

    // verifyOtp already established a session, so the user lands signed in.
    // "/" applies the role-based landing page.
    router.push("/");
  }

  async function handleResend() {
    notify("");
    if (cooldown > 0 || isLoading) return;
    if (!configured) {
      notify("Supabase env keys are not configured yet.", true);
      return;
    }
    setIsLoading(true);
    const result = await requestPasswordResetAction(email);
    setIsLoading(false);

    if (result.status === "sent") {
      setCooldown(60);
      notify("A new code has been sent.");
      return;
    }
    if (result.status === "not-found") {
      notify("No account is registered with this email address.", true);
      return;
    }
    notify("Could not resend the code. Please try again.", true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imperial Electric</p>
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          {step === "request" ? (
            <form onSubmit={handleRequest} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  name="email"
                  type="email"
                  required
                  disabled={isLoading}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <p className="text-xs text-slate-500">
                  We&apos;ll email you a 6-digit code to reset your password.
                </p>
              </div>
              {message ? (
                <p
                  className={
                    isError
                      ? "rounded-md bg-amber-50 p-3 text-sm text-amber-900"
                      : "rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"
                  }
                >
                  {message}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Send Code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label>Reset Code</Label>
                <Input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  disabled={isLoading}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  name="new_password"
                  type="password"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input
                  name="confirm_password"
                  type="password"
                  required
                  disabled={isLoading}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>
              {message ? (
                <p
                  className={
                    isError
                      ? "rounded-md bg-amber-50 p-3 text-sm text-amber-900"
                      : "rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"
                  }
                >
                  {message}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Reset Password
              </Button>
              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading || cooldown > 0}
                className="w-full text-center text-sm text-slate-500 underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
            </form>
          )}

          <div className="mt-4 text-center text-sm">
            <Link href="/login" className="text-slate-500 underline-offset-2 hover:underline">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
