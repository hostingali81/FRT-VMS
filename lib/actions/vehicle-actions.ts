"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getAllLookups, getVehicle } from "@/lib/data";
import { canAccessLocation, canCreateVehicle, canEditVehicle, canManageDrivers, canTransferVehicle } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function intValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function requireAdminClient() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) redirect("/login?error=server");
  return supabase;
}

export async function createVehicleAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  if (!canCreateVehicle(profile)) redirect("/vehicles?error=permission");

  const supabase = requireAdminClient();
  const circleId = textValue(formData, "circle_id");
  const divisionId = textValue(formData, "division_id");
  const substationId = textValue(formData, "substation_id");
  const registrationNo = textValue(formData, "registration_no");

  if (!circleId || !registrationNo) redirect("/vehicles/new?error=missing-required");
  if (!canAccessLocation(profile, { circleId, divisionId }, lookups)) redirect("/vehicles?error=permission");

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .insert({
      registration_no: registrationNo.toUpperCase(),
      vehicle_type: textValue(formData, "vehicle_type"),
      fuel_type: textValue(formData, "fuel_type"),
      model_year: intValue(formData, "model_year"),
      owner_name: textValue(formData, "owner_name"),
      owner_mobile: textValue(formData, "owner_mobile"),
      vendor_name: textValue(formData, "vendor_name"),
      gps_company: textValue(formData, "gps_company"),
      gps_device_id: textValue(formData, "gps_device_id"),
      circle_id: circleId,
      insurance_expiry: textValue(formData, "insurance_expiry"),
      fitness_expiry: textValue(formData, "fitness_expiry"),
      pollution_expiry: textValue(formData, "pollution_expiry"),
      status: textValue(formData, "status") ?? "active",
      notes: textValue(formData, "notes"),
    })
    .select("id")
    .single();

  if (error || !vehicle) redirect("/vehicles/new?error=create-failed");

  if (divisionId && substationId) {
    await supabase.from("vehicle_assignments").insert({
      vehicle_id: vehicle.id,
      circle_id: circleId,
      division_id: divisionId,
      substation_id: substationId,
      assigned_from: textValue(formData, "assigned_from") ?? today(),
      assigned_by: textValue(formData, "assigned_by") ?? profile.name,
      notes: "Created with vehicle master",
    });

    await supabase.from("vehicle_status_history").insert({
      vehicle_id: vehicle.id,
      status: textValue(formData, "status") ?? "active",
      from_date: textValue(formData, "assigned_from") ?? today(),
      recorded_by: profile.name,
      remarks: "Vehicle created",
    });
  }

  revalidatePath("/vehicles");
  revalidatePath("/dashboard");
  redirect(`/vehicles/${vehicle.id}`);
}

export async function updateVehicleAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const supabase = requireAdminClient();
  const vehicleId = textValue(formData, "vehicle_id");
  if (!vehicleId) redirect("/vehicles?error=missing-vehicle");

  const vehicle = await getVehicle(vehicleId, profile);
  if (!vehicle || !canEditVehicle(profile, vehicle, lookups)) redirect("/vehicles?error=permission");

  const { error } = await supabase
    .from("vehicles")
    .update({
      registration_no: textValue(formData, "registration_no")?.toUpperCase() ?? vehicle.registration_no,
      vehicle_type: textValue(formData, "vehicle_type"),
      fuel_type: textValue(formData, "fuel_type"),
      model_year: intValue(formData, "model_year"),
      owner_name: textValue(formData, "owner_name"),
      owner_mobile: textValue(formData, "owner_mobile"),
      vendor_name: textValue(formData, "vendor_name"),
      gps_company: textValue(formData, "gps_company"),
      gps_device_id: textValue(formData, "gps_device_id"),
      insurance_expiry: textValue(formData, "insurance_expiry"),
      fitness_expiry: textValue(formData, "fitness_expiry"),
      pollution_expiry: textValue(formData, "pollution_expiry"),
      notes: textValue(formData, "notes"),
    })
    .eq("id", vehicleId);

  if (error) redirect(`/vehicles/${vehicleId}/edit?error=update-failed`);

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}?updated=1`);
}

export async function transferVehicleAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const supabase = requireAdminClient();
  const vehicleId = textValue(formData, "vehicle_id");
  if (!vehicleId) redirect("/vehicles?error=missing-vehicle");

  const vehicle = await getVehicle(vehicleId, profile);
  if (!vehicle) redirect("/vehicles?error=permission");

  const toCircleId = textValue(formData, "to_circle_id");
  const toDivisionId = textValue(formData, "to_division_id");
  const toSubstationId = textValue(formData, "to_substation_id");
  const transferDate = textValue(formData, "transfer_date");
  const approvedBy = textValue(formData, "approved_by");

  if (!toCircleId || !toDivisionId || !toSubstationId || !transferDate || !approvedBy) {
    redirect(`/vehicles/${vehicleId}/transfer?error=missing-required`);
  }

  if (!canTransferVehicle(profile, vehicle, toCircleId, lookups)) {
    redirect(`/vehicles/${vehicleId}/transfer?error=permission`);
  }
  if (!canAccessLocation(profile, { circleId: toCircleId, divisionId: toDivisionId }, lookups)) {
    redirect(`/vehicles/${vehicleId}/transfer?error=destination-permission`);
  }

  const { error } = await supabase.rpc("transfer_vehicle", {
    p_vehicle_id: vehicleId,
    p_to_circle_id: toCircleId,
    p_to_division_id: toDivisionId,
    p_to_substation_id: toSubstationId,
    p_transfer_date: transferDate,
    p_reason: textValue(formData, "reason") ?? "Administrative",
    p_approved_by: approvedBy,
    p_remarks: textValue(formData, "remarks"),
  });

  if (error) redirect(`/vehicles/${vehicleId}/transfer?error=transfer-failed`);

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/transfers");
  revalidatePath("/vehicle-history");
  revalidatePath("/dashboard");
  redirect(`/vehicles/${vehicleId}?transferred=1`);
}

export async function changeVehicleStatusAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const supabase = requireAdminClient();
  const vehicleId = textValue(formData, "vehicle_id");
  if (!vehicleId) redirect("/vehicles?error=missing-vehicle");

  const vehicle = await getVehicle(vehicleId, profile);
  if (!vehicle || !canEditVehicle(profile, vehicle, lookups)) redirect("/vehicles?error=permission");

  const status = textValue(formData, "status");
  if (!status) redirect(`/vehicles/${vehicleId}?error=missing-status`);

  const { error } = await supabase.rpc("change_vehicle_status", {
    p_vehicle_id: vehicleId,
    p_status: status,
    p_from_date: textValue(formData, "from_date") ?? today(),
    p_recorded_by: profile.name,
    p_remarks: textValue(formData, "remarks"),
  });

  if (error) redirect(`/vehicles/${vehicleId}?error=status-failed`);

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/vehicle-history");
  revalidatePath("/dashboard");
  redirect(`/vehicles/${vehicleId}?status=1`);
}

export async function replaceDriverAssignmentAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const supabase = requireAdminClient();
  const vehicleId = textValue(formData, "vehicle_id");
  const driverId = textValue(formData, "driver_id");
  const shift = textValue(formData, "shift");

  if (!vehicleId || !driverId || !shift) redirect("/vehicles?error=missing-driver-assignment");

  const vehicle = await getVehicle(vehicleId, profile);
  if (!vehicle || !canEditVehicle(profile, vehicle, lookups)) redirect("/vehicles?error=permission");

  const { data: driver } = await supabase.from("drivers").select("id,circle_id").eq("id", driverId).maybeSingle();
  if (!driver || !canAccessLocation(profile, { circleId: driver.circle_id }, lookups)) {
    redirect(`/vehicles/${vehicleId}?error=driver-permission`);
  }

  const { error } = await supabase.rpc("replace_driver_assignment", {
    p_vehicle_id: vehicleId,
    p_driver_id: driverId,
    p_shift: shift,
    p_from_date: textValue(formData, "from_date") ?? today(),
    p_remarks: textValue(formData, "remarks"),
  });

  if (error) redirect(`/vehicles/${vehicleId}?error=driver-failed`);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/drivers");
  revalidatePath("/alerts");
  redirect(`/vehicles/${vehicleId}?driver=1`);
}

export async function createDriverAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const supabase = requireAdminClient();
  if (!canManageDrivers(profile)) redirect("/drivers?error=permission");

  const name = textValue(formData, "name");
  const circleId = textValue(formData, "circle_id");
  if (!name || !circleId) redirect("/drivers?error=missing-required");
  const driverCircleAllowed =
    profile.role === "division_incharge"
      ? profile.circle_id === circleId
      : canAccessLocation(profile, { circleId }, lookups);
  if (!driverCircleAllowed) redirect("/drivers?error=permission");

  await supabase.from("drivers").insert({
    name,
    mobile: textValue(formData, "mobile"),
    license_no: textValue(formData, "license_no"),
    license_expiry: textValue(formData, "license_expiry"),
    address: textValue(formData, "address"),
    circle_id: circleId,
    status: textValue(formData, "status") ?? "active",
  });

  revalidatePath("/drivers");
  revalidatePath("/alerts");
  redirect("/drivers?created=1");
}
