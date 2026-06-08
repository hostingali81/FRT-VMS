"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getAllLookups, getVehicle } from "@/lib/data";
import { canAccessLocation, canCreateVehicle, canEditVehicle, canManageDrivers, canTransferVehicle } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { driverOwnershipSchema, driverSchema, fuelLogSchema, fuelOwnershipSchema, statusSchema, transferSchema, vehicleSchema } from "@/lib/validations";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function requireAdminClient() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Database connection failed");
  return supabase;
}

export async function createVehicleAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  if (!canCreateVehicle(profile)) throw new Error("Unauthorized: Permission denied");

  const rawData = Object.fromEntries(formData.entries());
  const validated = vehicleSchema.safeParse(rawData);

  if (!validated.success) {
    const error = validated.error.issues[0].message;
    redirect(`/vehicles/new?error=${encodeURIComponent(error)}`);
  }

  const data = validated.data;
  const divisionId = formData.get("division_id") as string;
  const substationId = formData.get("substation_id") as string;

  if (!canAccessLocation(profile, { circleId: data.circle_id, divisionId }, lookups)) {
    throw new Error("Unauthorized: You don't have access to this location");
  }

  const supabase = requireAdminClient();
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .insert({
      ...data,
      registration_no: data.registration_no.toUpperCase(),
      frt_no: data.frt_no || null,
      model_year: data.model_year || null,
      insurance_expiry: data.insurance_expiry || null,
      fitness_expiry: data.fitness_expiry || null,
      pollution_expiry: data.pollution_expiry || null,
    })
    .select("id")
    .single();

  if (error || !vehicle) throw new Error("Failed to create vehicle: " + error?.message);

  // Initial fuel ownership history record (always, not just when assigned)
  await supabase.from("vehicle_fuel_ownership_history").insert({
    vehicle_id: vehicle.id,
    ownership: data.fuel_ownership ?? "company",
    from_date: (formData.get("assigned_from") as string) || today(),
    changed_by: profile.name,
    remarks: "Vehicle created",
  });

  // Initial driver ownership history record (always, not just when assigned)
  await supabase.from("vehicle_driver_ownership_history").insert({
    vehicle_id: vehicle.id,
    ownership: data.driver_ownership ?? "company",
    from_date: (formData.get("assigned_from") as string) || today(),
    changed_by: profile.name,
    remarks: "Vehicle created",
  });

  if (divisionId && substationId) {
    await supabase.from("vehicle_assignments").insert({
      vehicle_id: vehicle.id,
      circle_id: data.circle_id,
      division_id: divisionId,
      substation_id: substationId,
      assigned_from: (formData.get("assigned_from") as string) || today(),
      assigned_by: (formData.get("assigned_by") as string) || profile.name,
      notes: "Created with vehicle master",
    });

    await supabase.from("vehicle_status_history").insert({
      vehicle_id: vehicle.id,
      status: data.status,
      from_date: (formData.get("assigned_from") as string) || today(),
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
  const vehicleId = formData.get("vehicle_id") as string;
  if (!vehicleId) throw new Error("Missing vehicle ID");

  const vehicle = await getVehicle(vehicleId, profile);
  if (!vehicle || !canEditVehicle(profile, vehicle, lookups)) throw new Error("Unauthorized");

  const rawData = Object.fromEntries(formData.entries());
  const validated = vehicleSchema.partial().safeParse(rawData);

  if (!validated.success) {
    const error = validated.error.issues[0].message;
    redirect(`/vehicles/${vehicleId}/edit?error=${encodeURIComponent(error)}`);
  }

  const data = validated.data;
  const supabase = requireAdminClient();
  const { error } = await supabase
    .from("vehicles")
    .update({
      ...data,
      registration_no: data.registration_no?.toUpperCase(),
    })
    .eq("id", vehicleId);

  if (error) throw new Error("Update failed: " + error.message);

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}?updated=1`);
}

export async function transferVehicleAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const rawData = Object.fromEntries(formData.entries());
  const validated = transferSchema.safeParse(rawData);

  if (!validated.success) {
    const error = validated.error.issues[0].message;
    const vId = formData.get("vehicle_id");
    redirect(`/vehicles/${vId}/transfer?error=${encodeURIComponent(error)}`);
  }

  const data = validated.data;
  const vehicle = await getVehicle(data.vehicle_id, profile);
  if (!vehicle) throw new Error("Vehicle not found or unauthorized");

  if (!canTransferVehicle(profile, vehicle, data.to_circle_id, lookups)) {
    throw new Error("Unauthorized: Transfer not allowed");
  }
  if (!canAccessLocation(profile, { circleId: data.to_circle_id, divisionId: data.to_division_id }, lookups)) {
    throw new Error("Unauthorized: No access to destination");
  }

  const supabase = requireAdminClient();
  const { error } = await supabase.rpc("transfer_vehicle", {
    p_vehicle_id: data.vehicle_id,
    p_to_circle_id: data.to_circle_id,
    p_to_division_id: data.to_division_id,
    p_to_substation_id: data.to_substation_id,
    p_transfer_date: data.transfer_date,
    p_reason: data.reason,
    p_approved_by: data.approved_by,
    p_remarks: data.remarks,
  });

  if (error) throw new Error("Transfer failed: " + error.message);

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${data.vehicle_id}`);
  revalidatePath("/transfers");
  revalidatePath("/vehicle-history");
  revalidatePath("/dashboard");
  redirect(`/vehicles/${data.vehicle_id}?transferred=1`);
}

export async function changeVehicleStatusAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const rawData = Object.fromEntries(formData.entries());
  const validated = statusSchema.safeParse(rawData);

  if (!validated.success) {
    const error = validated.error.issues[0].message;
    redirect(`/vehicles/${rawData.vehicle_id}?error=${encodeURIComponent(error)}`);
  }

  const data = validated.data;
  const vehicle = await getVehicle(data.vehicle_id, profile);
  if (!vehicle || !canEditVehicle(profile, vehicle, lookups)) throw new Error("Unauthorized");

  const supabase = requireAdminClient();
  const { error } = await supabase.rpc("change_vehicle_status", {
    p_vehicle_id: data.vehicle_id,
    p_status: data.status,
    p_from_date: data.from_date,
    p_recorded_by: profile.name,
    p_remarks: data.remarks,
  });

  if (error) throw new Error("Status update failed: " + error.message);

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${data.vehicle_id}`);
  revalidatePath("/vehicle-history");
  revalidatePath("/dashboard");
  redirect(`/vehicles/${data.vehicle_id}?status=1`);
}

export async function changeFuelOwnershipAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const rawData = Object.fromEntries(formData.entries());
  const validated = fuelOwnershipSchema.safeParse(rawData);

  if (!validated.success) {
    const error = validated.error.issues[0].message;
    redirect(`/vehicles/${rawData.vehicle_id}?error=${encodeURIComponent(error)}`);
  }

  const data = validated.data;
  const vehicle = await getVehicle(data.vehicle_id, profile);
  if (!vehicle || !canEditVehicle(profile, vehicle, lookups)) throw new Error("Unauthorized");

  const supabase = requireAdminClient();
  const { error } = await supabase.rpc("change_vehicle_fuel_ownership", {
    p_vehicle_id: data.vehicle_id,
    p_ownership: data.ownership,
    p_from_date: data.from_date,
    p_changed_by: profile.name,
    p_remarks: data.remarks,
  });

  if (error) throw new Error("Fuel ownership update failed: " + error.message);

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${data.vehicle_id}`);
  redirect(`/vehicles/${data.vehicle_id}?fuel=1`);
}

export async function changeDriverOwnershipAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const rawData = Object.fromEntries(formData.entries());
  const validated = driverOwnershipSchema.safeParse(rawData);

  if (!validated.success) {
    const error = validated.error.issues[0].message;
    redirect(`/vehicles/${rawData.vehicle_id}?error=${encodeURIComponent(error)}`);
  }

  const data = validated.data;
  const vehicle = await getVehicle(data.vehicle_id, profile);
  if (!vehicle || !canEditVehicle(profile, vehicle, lookups)) throw new Error("Unauthorized");

  const supabase = requireAdminClient();
  const { error } = await supabase.rpc("change_vehicle_driver_ownership", {
    p_vehicle_id: data.vehicle_id,
    p_ownership: data.ownership,
    p_from_date: data.from_date,
    p_changed_by: profile.name,
    p_remarks: data.remarks,
  });

  if (error) throw new Error("Driver ownership update failed: " + error.message);

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${data.vehicle_id}`);
  redirect(`/vehicles/${data.vehicle_id}?driverby=1`);
}

export async function replaceDriverAssignmentAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const vehicleId = formData.get("vehicle_id") as string;
  const driverId = formData.get("driver_id") as string;
  const shift = formData.get("shift") as string;

  if (!vehicleId || !driverId || !shift) throw new Error("Missing assignment data");

  const vehicle = await getVehicle(vehicleId, profile);
  if (!vehicle || !canEditVehicle(profile, vehicle, lookups)) throw new Error("Unauthorized");

  const supabase = requireAdminClient();
  const { data: driver } = await supabase.from("drivers").select("id,circle_id").eq("id", driverId).maybeSingle();
  if (!driver || !canAccessLocation(profile, { circleId: driver.circle_id }, lookups)) {
    throw new Error("Unauthorized: No access to driver's circle");
  }

  const { error } = await supabase.rpc("replace_driver_assignment", {
    p_vehicle_id: vehicleId,
    p_driver_id: driverId,
    p_shift: shift,
    p_from_date: (formData.get("from_date") as string) || today(),
    p_remarks: formData.get("remarks") as string,
  });

  if (error) throw new Error("Driver assignment failed: " + error.message);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/drivers");
  revalidatePath("/alerts");
  redirect(`/vehicles/${vehicleId}?driver=1`);
}

export async function addFuelLogAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const rawData = Object.fromEntries(formData.entries());
  // "add" → dedicated /fuel-log/add page; otherwise the in-profile Fuel Logs tab
  const fromAddPage = formData.get("return_to") === "add";
  const errorBack = (msg: string) =>
    fromAddPage
      ? `/fuel-log/add?error=${encodeURIComponent(msg)}`
      : `/vehicles/${rawData.vehicle_id}?error=${encodeURIComponent(msg)}&tab=Fuel+Logs`;

  const validated = fuelLogSchema.safeParse(rawData);
  if (!validated.success) {
    redirect(errorBack(validated.error.issues[0].message));
  }

  const data = validated.data;
  const vehicle = await getVehicle(data.vehicle_id, profile);
  if (!vehicle || !canEditVehicle(profile, vehicle, lookups)) {
    redirect(errorBack("You don't have access to this vehicle"));
  }
  if (vehicle.fuel_ownership !== "company") {
    redirect(errorBack("Fuel entries are only for company-fuel vehicles"));
  }

  const supabase = requireAdminClient();
  const { error } = await supabase.from("vehicle_fuel_logs").insert({
    vehicle_id: data.vehicle_id,
    log_date: data.log_date,
    fuel_type: data.fuel_type,
    fuel_litres: data.fuel_litres,
    fuel_amount: data.fuel_amount ?? null,
    recorded_by: profile.name,
    notes: data.notes ?? null,
  });

  if (error) throw new Error("Failed to save fuel entry: " + error.message);

  revalidatePath(`/vehicles/${data.vehicle_id}`);
  revalidatePath("/fuel");
  revalidatePath("/fuel-log");
  redirect(
    fromAddPage
      ? `/fuel-log/add?added=${encodeURIComponent(vehicle.registration_no)}`
      : `/vehicles/${data.vehicle_id}?fuellog=1&tab=Fuel+Logs`,
  );
}

export async function createDriverAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  if (!canManageDrivers(profile)) throw new Error("Unauthorized");

  const rawData = Object.fromEntries(formData.entries());
  const validated = driverSchema.safeParse(rawData);

  if (!validated.success) {
    const error = validated.error.issues[0].message;
    redirect(`/drivers?error=${encodeURIComponent(error)}`);
  }

  const data = validated.data;
  if (!canAccessLocation(profile, { circleId: data.circle_id }, lookups)) {
    throw new Error("Unauthorized access to this circle");
  }

  const supabase = requireAdminClient();
  const { error } = await supabase.from("drivers").insert(data);

  if (error) throw new Error("Failed to create driver: " + error.message);

  revalidatePath("/drivers");
  revalidatePath("/alerts");
  redirect("/drivers?created=1");
}

