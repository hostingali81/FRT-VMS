"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requireAdminClient() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) redirect("/login?error=server");
  return supabase;
}

export async function createUserAction(formData: FormData) {
  await requireRole(["super_admin"]);
  const supabase = requireAdminClient();

  const email = textValue(formData, "email");
  const password = textValue(formData, "password");
  const name = textValue(formData, "name");
  const role = textValue(formData, "role") as UserRole | null;

  if (!email || !password || !name || !role) redirect("/admin?error=user-required");

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error || !data.user) redirect("/admin?error=user-create");

  const { error: profileError } = await supabase.from("user_profiles").insert({
    id: data.user.id,
    name,
    role,
    zone_id: textValue(formData, "zone_id"),
    circle_id: textValue(formData, "circle_id"),
    division_id: textValue(formData, "division_id"),
    is_active: true,
  });

  if (profileError) redirect("/admin?error=profile-create");

  revalidatePath("/admin");
  redirect("/admin?user=created");
}

export async function updateUserProfileAction(formData: FormData) {
  await requireRole(["super_admin"]);
  const supabase = requireAdminClient();
  const userId = textValue(formData, "user_id");
  const name = textValue(formData, "name");
  const role = textValue(formData, "role") as UserRole | null;

  if (!userId || !name || !role) redirect("/admin?error=user-required");

  const { error } = await supabase
    .from("user_profiles")
    .update({
      name,
      role,
      zone_id: textValue(formData, "zone_id"),
      circle_id: textValue(formData, "circle_id"),
      division_id: textValue(formData, "division_id"),
      is_active: textValue(formData, "is_active") === "true",
    })
    .eq("id", userId);

  if (error) redirect("/admin?error=user-update");

  revalidatePath("/admin");
  redirect("/admin?user=updated");
}

export async function createZoneAction(formData: FormData) {
  await requireRole(["super_admin"]);
  const supabase = requireAdminClient();
  const name = textValue(formData, "name");
  if (!name) redirect("/admin?error=zone-required");

  const { error } = await supabase.from("zones").insert({ name });
  if (error) redirect("/admin?error=zone-create");

  revalidatePath("/admin");
  redirect("/admin?zone=created");
}

export async function createCircleAction(formData: FormData) {
  await requireRole(["super_admin"]);
  const supabase = requireAdminClient();
  const name = textValue(formData, "name");
  if (!name) redirect("/admin?error=circle-required");

  const { error } = await supabase.from("circles").insert({
    name,
    zone_id: textValue(formData, "zone_id"),
    state: textValue(formData, "state") ?? "Uttar Pradesh",
    discom: textValue(formData, "discom") ?? "MVVNL",
    contract_ref: textValue(formData, "contract_ref"),
  });

  if (error) redirect("/admin?error=circle-create");

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin?circle=created");
}

export async function createDivisionAction(formData: FormData) {
  await requireRole(["super_admin"]);
  const supabase = requireAdminClient();
  const name = textValue(formData, "name");
  const circleId = textValue(formData, "circle_id");
  if (!name || !circleId) redirect("/admin?error=division-required");

  const { error } = await supabase.from("divisions").insert({ name, circle_id: circleId });
  if (error) redirect("/admin?error=division-create");

  revalidatePath("/admin");
  redirect("/admin?division=created");
}

export async function createSubstationAction(formData: FormData) {
  await requireRole(["super_admin"]);
  const supabase = requireAdminClient();
  const name = textValue(formData, "name");
  const divisionId = textValue(formData, "division_id");
  if (!name || !divisionId) redirect("/admin?error=substation-required");

  const { error } = await supabase.from("substations").insert({ name, division_id: divisionId });
  if (error) redirect("/admin?error=substation-create");

  revalidatePath("/admin");
  redirect("/admin?substation=created");
}

