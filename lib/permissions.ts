import type { Circle, Division, FleetVehicle, LookupData, UserProfile, UserRole } from "@/lib/types";

export function accessibleCircleIds(profile: UserProfile, lookups: LookupData) {
  if (profile.role === "super_admin" || profile.role === "zonal_manager") {
    return new Set(lookups.circles.map((circle) => circle.id));
  }

  // Division-scoped roles never get circle-wide data access. Their profile carries
  // a circle_id only as form context (the parent of their division); treating it as
  // an access grant would leak every vehicle/driver/transfer in the whole circle.
  if (profile.role === "division_incharge" || (profile.role === "viewer" && profile.division_id)) {
    return new Set<string>();
  }

  if (profile.circle_id) return new Set([profile.circle_id]);

  // Zone-scoped profile (e.g. a viewer assigned a whole zone): every circle in
  // that zone is accessible.
  if (profile.zone_id) {
    return new Set(lookups.circles.filter((circle) => circle.zone_id === profile.zone_id).map((circle) => circle.id));
  }

  return new Set<string>();
}

export function accessibleDivisionIds(profile: UserProfile, lookups: LookupData) {
  if (profile.role === "division_incharge" || (profile.role === "viewer" && profile.division_id)) {
    return new Set(profile.division_id ? [profile.division_id] : []);
  }

  const circleIds = accessibleCircleIds(profile, lookups);
  return new Set(lookups.divisions.filter((division) => circleIds.has(division.circle_id)).map((division) => division.id));
}

export function filterLookupsForProfile(lookups: LookupData, profile: UserProfile): LookupData {
  if (profile.role === "super_admin") return lookups;

  const circleIds = accessibleCircleIds(profile, lookups);
  const divisionIds = accessibleDivisionIds(profile, lookups);
  const divisions = lookups.divisions.filter((division) => divisionIds.has(division.id));

  // A division-scoped user has no circle-wide access, but still needs its parent
  // circle resolvable in dropdowns/labels. Include the parent circle of every
  // accessible division without exposing that circle's other divisions.
  const circleIdsForLookups = new Set(circleIds);
  for (const division of divisions) circleIdsForLookups.add(division.circle_id);

  return {
    zones: lookups.zones?.filter((zone) => zone.id === profile.zone_id),
    circles: lookups.circles.filter((circle) => circleIdsForLookups.has(circle.id)),
    divisions,
    substations: lookups.substations.filter((substation) => divisionIds.has(substation.division_id)),
  };
}

export function canSeeCircle(profile: UserProfile, circleId: string | null | undefined, lookups: LookupData) {
  if (!circleId) return false;
  return accessibleCircleIds(profile, lookups).has(circleId);
}

export function canSeeDivision(profile: UserProfile, divisionId: string | null | undefined, lookups: LookupData) {
  if (!divisionId) return false;
  return accessibleDivisionIds(profile, lookups).has(divisionId);
}

export function canSeeVehicle(profile: UserProfile, vehicle: FleetVehicle, lookups: LookupData) {
  if (profile.role === "super_admin") return true;
  if (canSeeCircle(profile, vehicle.home_circle_id, lookups) || canSeeCircle(profile, vehicle.current_circle_id, lookups)) return true;
  return canSeeDivision(profile, vehicle.division_id, lookups);
}

export function canCreateVehicle(profile: UserProfile) {
  return ["super_admin", "circle_incharge", "division_incharge"].includes(profile.role);
}

export function canManageDrivers(profile: UserProfile) {
  return ["super_admin", "circle_incharge", "division_incharge"].includes(profile.role);
}

export function canEditVehicle(profile: UserProfile, vehicle: FleetVehicle, lookups: LookupData) {
  if (!canCreateVehicle(profile)) return false;
  if (profile.role === "super_admin") return true;
  if (profile.role === "circle_incharge") return canSeeCircle(profile, vehicle.current_circle_id ?? vehicle.home_circle_id, lookups);
  return canSeeDivision(profile, vehicle.division_id, lookups);
}

export function canTransferVehicle(profile: UserProfile, vehicle: FleetVehicle, toCircleId: string, lookups: LookupData) {
  if (profile.role === "super_admin") return true;

  const fromCircleId = vehicle.current_circle_id ?? vehicle.home_circle_id;
  const isCrossCircle = Boolean(fromCircleId && toCircleId && fromCircleId !== toCircleId);

  // Cross-circle moves are reserved for admins (zonal_manager) and super_admin only.
  if (isCrossCircle) {
    return profile.role === "zonal_manager" && canSeeCircle(profile, fromCircleId, lookups) && canSeeCircle(profile, toCircleId, lookups);
  }

  // Circle incharge can only move vehicles within their own circle.
  // Division incharge cannot transfer/relocate vehicles at all.
  if (profile.role === "circle_incharge") return canSeeCircle(profile, fromCircleId, lookups);

  return false;
}

export function canInitiateTransfer(profile: UserProfile, vehicle: FleetVehicle, lookups: LookupData) {
  if (!canSeeVehicle(profile, vehicle, lookups)) return false;
  return ["super_admin", "zonal_manager", "circle_incharge"].includes(profile.role);
}

export function canAccessLocation(profile: UserProfile, location: { circleId?: string | null; divisionId?: string | null }, lookups: LookupData) {
  if (profile.role === "super_admin") return true;
  if (profile.role === "division_incharge") {
    return location.divisionId ? canSeeDivision(profile, location.divisionId, lookups) : false;
  }
  if (location.divisionId && canSeeDivision(profile, location.divisionId, lookups)) return true;
  if (location.circleId && canSeeCircle(profile, location.circleId, lookups)) return true;
  return false;
}

export function canOpenAdmin(profile: UserProfile) {
  return profile.role === "super_admin";
}

export function allowedRolesForCreator(profile: UserProfile): UserRole[] {
  if (profile.role === "super_admin") {
    return ["super_admin", "zonal_manager", "circle_incharge", "division_incharge", "viewer"];
  }
  return [];
}

export function circleName(circles: Circle[], id: string | null | undefined) {
  return circles.find((circle) => circle.id === id)?.name ?? "Not assigned";
}

export function divisionName(divisions: Division[], id: string | null | undefined) {
  return divisions.find((division) => division.id === id)?.name ?? "Not assigned";
}
