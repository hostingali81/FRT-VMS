"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { USER_ROLES } from "@/lib/types";
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

// Keep only the location scope that matches the role, and require the field the
// role actually needs. Parent ids (circle/zone) come in as hidden inputs derived
// on the client, so a division user still has a populated circle/zone.
function normalizeScope(role: UserRole, formData: FormData) {
  const zone = textValue(formData, "zone_id");
  const circle = textValue(formData, "circle_id");
  const division = textValue(formData, "division_id");

  switch (role) {
    case "super_admin":
      return { zone_id: null, circle_id: null, division_id: null };
    case "zonal_manager":
      if (!zone) redirect("/admin?error=scope-required");
      return { zone_id: zone, circle_id: null, division_id: null };
    case "circle_incharge":
      if (!circle) redirect("/admin?error=scope-required");
      return { zone_id: zone, circle_id: circle, division_id: null };
    case "division_incharge":
      if (!division) redirect("/admin?error=scope-required");
      return { zone_id: zone, circle_id: circle, division_id: division };
    case "viewer":
      // Viewer is scoped to exactly one level — keep the most specific provided.
      if (division) return { zone_id: null, circle_id: null, division_id: division };
      if (circle) return { zone_id: null, circle_id: circle, division_id: null };
      if (zone) return { zone_id: zone, circle_id: null, division_id: null };
      redirect("/admin?error=scope-required");
    default:
      return { zone_id: null, circle_id: null, division_id: null };
  }
}

export async function createUserAction(formData: FormData) {
  await requireRole(["super_admin"]);
  const supabase = requireAdminClient();

  const email = textValue(formData, "email");
  const password = textValue(formData, "password");
  const name = textValue(formData, "name");
  const role = textValue(formData, "role") as UserRole | null;

  if (!email || !password || !name || !role) redirect("/admin?error=user-required");
  if (password.length < 12) redirect("/admin?error=password-too-short");
  if (!(USER_ROLES as readonly string[]).includes(role)) redirect("/admin?error=invalid-role");

  // Validate scope before creating the auth user so a missing field can't leave
  // an orphaned auth user with no profile.
  const scope = normalizeScope(role, formData);

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
    ...scope,
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
  if (!(USER_ROLES as readonly string[]).includes(role)) redirect("/admin?error=invalid-role");

  const scope = normalizeScope(role, formData);
  const { error } = await supabase
    .from("user_profiles")
    .update({
      name,
      role,
      ...scope,
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

