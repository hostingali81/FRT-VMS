"use server";

import { redirect } from "next/navigation";
import { getProfileCount } from "@/lib/auth";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function logoutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createFirstSuperAdminAction(formData: FormData) {
  const existingProfiles = await getProfileCount();
  if (existingProfiles > 0) redirect("/login?error=setup-closed");

  const supabase = createSupabaseAdminClient();
  if (!supabase) redirect("/setup?error=server");

  const email = textValue(formData, "email");
  const password = textValue(formData, "password");
  const name = textValue(formData, "name");

  if (!email || !password || !name) redirect("/setup?error=missing");

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error || !data.user) redirect("/setup?error=create-user");

  const { error: profileError } = await supabase.from("user_profiles").insert({
    id: data.user.id,
    name,
    role: "super_admin",
    is_active: true,
  });

  if (profileError) redirect("/setup?error=create-profile");

  redirect("/login?setup=1");
}

