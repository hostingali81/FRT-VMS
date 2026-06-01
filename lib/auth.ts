import { redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { LookupData, UserProfile, UserRole } from "@/lib/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  zonal_manager: "Zonal Manager",
  circle_incharge: "Circle Incharge",
  division_incharge: "Division Incharge",
  viewer: "Viewer",
};

export async function getSessionUser() {
  if (!isSupabaseConfigured()) return null;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,name,role,circle_id,division_id,zone_id,is_active,created_at,updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data || !data.is_active) return null;
  return data as UserProfile;
}

export async function requireProfile(): Promise<UserProfile> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?error=profile");

  return profile;
}

export async function requireRole(roles: UserRole[]) {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect("/dashboard?error=permission");
  return profile;
}

export async function getProfileCount() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("user_profiles")
    .select("id", { count: "exact", head: true });

  if (error) return 0;
  return count ?? 0;
}

export function formatScope(profile: UserProfile, lookups?: LookupData) {
  if (profile.role === "super_admin") return "All Circles";

  if (profile.role === "zonal_manager") {
    const zone = lookups?.zones?.find((item) => item.id === profile.zone_id);
    return zone ? `Zone: ${zone.name}` : "Assigned Zone";
  }

  const circle = lookups?.circles.find((item) => item.id === profile.circle_id);
  const division = lookups?.divisions.find((item) => item.id === profile.division_id);

  if (profile.role === "division_incharge") return `Division: ${division?.name ?? "Assigned"}`;
  if (profile.role === "viewer" && division) return `Viewer: ${division.name}`;
  if (circle) return `Circle: ${circle.name}`;
  return "Assigned Scope";
}

export function hasRole(profile: UserProfile, roles: UserRole[]) {
  return roles.includes(profile.role);
}

