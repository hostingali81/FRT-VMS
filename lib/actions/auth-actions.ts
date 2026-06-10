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

