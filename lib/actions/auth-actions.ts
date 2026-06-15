"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser, requireProfile } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  verifyUserPassword,
} from "@/lib/supabase/server";

export async function logoutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Walks the auth user list (admin only) to confirm an email belongs to a real
// account. Returns null on a lookup failure so callers can distinguish "no
// account" from "couldn't check". listUsers is paginated; we stop as soon as we
// match or run out of pages.
async function emailHasAccount(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  email: string,
): Promise<boolean | null> {
  const target = email.toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return null;

    const users = data?.users ?? [];
    if (users.some((user) => (user.email ?? "").toLowerCase() === target)) return true;
    if (users.length < perPage) return false;
  }

  return false;
}

type PasswordResetStatus = "sent" | "not-found" | "invalid" | "error";

// Public (no auth) — called from the forgot-password page. Unlike a bare
// resetPasswordForEmail, this first verifies the email maps to an account so the
// UI can tell the user when they've mistyped it, then sends the OTP code.
export async function requestPasswordResetAction(
  email: string,
): Promise<{ status: PasswordResetStatus }> {
  const trimmed = typeof email === "string" ? email.trim() : "";
  if (!trimmed) return { status: "invalid" };

  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "error" };

  const exists = await emailHasAccount(admin, trimmed);
  if (exists === null) return { status: "error" };
  if (!exists) return { status: "not-found" };

  // resetPasswordForEmail doesn't create a session, so the anon server client is
  // safe to use here — it just triggers the recovery email send.
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed);
  if (error) return { status: "error" };

  return { status: "sent" };
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function updateProfileNameAction(formData: FormData) {
  const profile = await requireProfile();
  const name = textValue(formData, "name");
  if (!name) redirect("/profile?error=name-required");

  const supabase = createSupabaseAdminClient();
  if (!supabase) redirect("/profile?error=server");

  const { error } = await supabase
    .from("user_profiles")
    .update({ name })
    .eq("id", profile.id);
  if (error) redirect("/profile?error=name-update");

  // Keep the auth user_metadata name in sync (best-effort; the profile row is
  // the source of truth the app reads from).
  await supabase.auth.admin.updateUserById(profile.id, { user_metadata: { name } });

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  redirect("/profile?profile=name-updated");
}

export async function updatePasswordAction(formData: FormData) {
  await requireProfile();
  const user = await getSessionUser();
  if (!user?.email) redirect("/profile?error=server");

  const currentPassword = textValue(formData, "current_password");
  const newPassword = textValue(formData, "new_password");
  const confirmPassword = textValue(formData, "confirm_password");

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect("/profile?error=password-required");
  }
  if (newPassword.length < 6) redirect("/profile?error=password-too-short");
  if (newPassword !== confirmPassword) redirect("/profile?error=password-mismatch");

  const validCurrent = await verifyUserPassword(user.email, currentPassword);
  if (!validCurrent) redirect("/profile?error=password-wrong");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) redirect("/profile?error=password-update");

  redirect("/profile?profile=password-updated");
}

