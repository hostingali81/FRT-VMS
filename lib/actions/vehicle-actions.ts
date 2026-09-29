"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getAllLookups, getVehicle } from "@/lib/data";
import { canAccessLocation, canCreateVehicle, canEditVehicle, canManageDrivers, canTransferVehicle } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  driverOwnershipSchema,
  driverSchema,
  fuelLogDeleteSchema,
  fuelLogSchema,
  fuelLogUpdateSchema,
  fuelOwnershipSchema,
  statusSchema,
  transferSchema,
  vehicleSchema,
  vehicleUpdateSchema,
} from "@/lib/validations";
import { istToday } from "@/lib/utils/month";

function today() {
  return istToday();
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
  redirect(`/vehicles/${vehicle.id}?vcreated=1`);
}

export async function updateVehicleAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const vehicleId = formData.get("vehicle_id") as string;
  if (!vehicleId) throw new Error("Missing vehicle ID");

  const vehicle = await getVehicle(vehicleId, profile);
  if (!vehicle || !canEditVehicle(profile, vehicle, lookups)) throw new Error("Unauthorized");

  const rawData = Object.fromEntries(formData.entries());
  const validated = vehicleUpdateSchema.safeParse(rawData);

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
  // Permission failures come back to the form as a readable message rather than
  // a thrown 500 — the user needs to know the move was refused and why.
  const refuse: (message: string) => never = (message) =>
    redirect(`/vehicles/${data.vehicle_id}/transfer?error=${encodeURIComponent(message)}`);

  const vehicle = await getVehicle(data.vehicle_id, profile);
  if (!vehicle) refuse("Vehicle not found, or you don't have access to it");

  if (!canTransferVehicle(profile, vehicle, data.to_circle_id, lookups)) {
    refuse("You can't move this vehicle. Cross-circle transfers need an Admin or HQ.");
  }
  if (!canAccessLocation(profile, { circleId: data.to_circle_id, divisionId: data.to_division_id }, lookups)) {
    refuse("You don't have access to the destination division");
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
    p_move_driver: data.move_driver,
  });

  if (error) refuse("Transfer failed: " + error.message);

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

/** IST date + optional HH:MM → absolute instant, or null when no time was given. */
function fuelLoggedAt(logDate: string, logTime: string | null | undefined): string | null {
  if (!logTime) return null;
  const dt = new Date(`${logDate}T${logTime}:00+05:30`);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function sameInstant(a: string | null | undefined, b: string | null | undefined) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

/**
 * Clear the cached GPS segment on the fills an edit/delete shifted, so the next
 * "Sync GPS Data" recomputes them (the sync only fills rows where
 * gps_distance_km IS NULL). A fill's segment starts at its previous same-type
 * fill, so moving or removing one entry only affects the fills inside the moved
 * window plus the first fill after it — later fills keep the same predecessor.
 */
async function resetFuelSegments(
  supabase: ReturnType<typeof requireAdminClient>,
  vehicleId: string,
  fromDate: string,
  toDate: string,
) {
  const { data: logs } = await supabase
    .from("vehicle_fuel_logs")
    .select("id,log_date")
    .eq("vehicle_id", vehicleId)
    .gte("log_date", fromDate)
    .order("log_date", { ascending: true });

  if (!logs || logs.length === 0) return;

  const boundary = (logs as { id: string; log_date: string }[]).find((l) => l.log_date > toDate)?.log_date;
  const ids = (logs as { id: string; log_date: string }[])
    .filter((l) => boundary === undefined || l.log_date <= boundary)
    .map((l) => l.id);
  if (ids.length === 0) return;

  await supabase
    .from("vehicle_fuel_logs")
    .update({ gps_distance_km: null, gps_synced_at: null })
    .in("id", ids);
}

/**
 * Filter/pagination params the /fuel-log/add correction table round-trips, so a
 * fix lands back on the list the user was looking at. Whitelisted and rebuilt
 * from scratch, so the form can't smuggle anything else (an `error=` banner, a
 * second `updated=`) into the redirect's query string.
 */
const FUEL_LOG_VIEW_PARAMS = ["q", "by", "div", "sub", "type", "from", "to", "page"] as const;

function fuelLogViewQuery(formData: FormData) {
  const raw = formData.get("return_query");
  if (typeof raw !== "string" || !raw) return "";
  const incoming = new URLSearchParams(raw);
  const kept = new URLSearchParams();
  for (const key of FUEL_LOG_VIEW_PARAMS) {
    const value = incoming.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `&${query}` : "";
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

  // Combine date + approximate time (entered in IST) into an absolute instant for
  // the GPS segment window. Blank/invalid time → null (the sync falls back to the
  // date's midnight).
  const loggedAt = fuelLoggedAt(data.log_date, data.log_time);

  const supabase = requireAdminClient();
  // Only send logged_at when a time was given, so "date only" entries keep working
  // even if the logged_at column hasn't been migrated yet.
  const insertRow: Record<string, unknown> = {
    vehicle_id: data.vehicle_id,
    log_date: data.log_date,
    fuel_type: data.fuel_type,
    fuel_litres: data.fuel_litres,
    fuel_amount: data.fuel_amount ?? null,
    recorded_by: profile.name,
    notes: data.notes ?? null,
  };
  if (loggedAt) insertRow.logged_at = loggedAt;
  const { error } = await supabase.from("vehicle_fuel_logs").insert(insertRow);

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

/** Correct an existing fill — wrong amount, wrong date, wrong vehicle. */
export async function updateFuelLogAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const rawData = Object.fromEntries(formData.entries());
  const fromAddPage = formData.get("return_to") === "add";
  const viewQuery = fuelLogViewQuery(formData);
  const errorBack = (msg: string) =>
    fromAddPage
      ? `/fuel-log/add?error=${encodeURIComponent(msg)}${viewQuery}`
      : `/vehicles/${rawData.vehicle_id}?error=${encodeURIComponent(msg)}&tab=Fuel+Logs`;

  const validated = fuelLogUpdateSchema.safeParse(rawData);
  if (!validated.success) {
    redirect(errorBack(validated.error.issues[0].message));
  }

  const data = validated.data;
  const supabase = requireAdminClient();

  const { data: existing, error: readError } = await supabase
    .from("vehicle_fuel_logs")
    .select("id, vehicle_id, log_date, logged_at, fuel_type")
    .eq("id", data.log_id)
    .maybeSingle();

  if (readError) throw new Error("Failed to load fuel entry: " + readError.message);
  if (!existing) redirect(errorBack("Fuel entry not found"));

  // The user must be able to edit both the vehicle the entry is leaving and the
  // one it lands on, so an entry can never be pushed outside its own scope.
  const sourceVehicle = await getVehicle(existing.vehicle_id as string, profile);
  if (!sourceVehicle || !canEditVehicle(profile, sourceVehicle, lookups)) {
    redirect(errorBack("You don't have access to this fuel entry"));
  }
  const targetVehicle =
    data.vehicle_id === existing.vehicle_id ? sourceVehicle : await getVehicle(data.vehicle_id, profile);
  if (!targetVehicle || !canEditVehicle(profile, targetVehicle, lookups)) {
    redirect(errorBack("You don't have access to this vehicle"));
  }
  if (targetVehicle.fuel_ownership !== "company") {
    redirect(errorBack("Fuel entries are only for company-fuel vehicles"));
  }

  const loggedAt = fuelLoggedAt(data.log_date, data.log_time);
  const { error } = await supabase
    .from("vehicle_fuel_logs")
    .update({
      vehicle_id: data.vehicle_id,
      log_date: data.log_date,
      logged_at: loggedAt,
      fuel_type: data.fuel_type,
      fuel_litres: data.fuel_litres,
      fuel_amount: data.fuel_amount ?? null,
      notes: data.notes ?? null,
    })
    .eq("id", data.log_id);

  if (error) throw new Error("Failed to update fuel entry: " + error.message);

  // Only vehicle/date/time/type edits move the GPS segment chain; a corrected
  // amount or note leaves the measured distances valid.
  const chainMoved =
    existing.vehicle_id !== data.vehicle_id ||
    existing.log_date !== data.log_date ||
    existing.fuel_type !== data.fuel_type ||
    !sameInstant(existing.logged_at as string | null, loggedAt);

  if (chainMoved) {
    const [from, to] =
      (existing.log_date as string) < data.log_date
        ? [existing.log_date as string, data.log_date]
        : [data.log_date, existing.log_date as string];
    await resetFuelSegments(supabase, existing.vehicle_id as string, from, to);
    if (existing.vehicle_id !== data.vehicle_id) {
      await resetFuelSegments(supabase, data.vehicle_id, data.log_date, data.log_date);
    }
  }

  revalidatePath(`/vehicles/${data.vehicle_id}`);
  if (existing.vehicle_id !== data.vehicle_id) revalidatePath(`/vehicles/${existing.vehicle_id}`);
  revalidatePath("/fuel");
  revalidatePath("/fuel-log");
  revalidatePath("/fuel-log/add");
  redirect(
    fromAddPage
      ? `/fuel-log/add?updated=${encodeURIComponent(targetVehicle.registration_no)}${chainMoved ? "&resync=1" : ""}${viewQuery}`
      : `/vehicles/${data.vehicle_id}?fuelupdated=1&tab=Fuel+Logs`,
  );
}

/** Remove a fill that shouldn't exist at all (duplicate / wrong vehicle entry). */
export async function deleteFuelLogAction(formData: FormData) {
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const fromAddPage = formData.get("return_to") === "add";
  const viewQuery = fuelLogViewQuery(formData);
  const validated = fuelLogDeleteSchema.safeParse(Object.fromEntries(formData.entries()));

  const errorBack = (msg: string, vehicleId?: string) =>
    fromAddPage
      ? `/fuel-log/add?error=${encodeURIComponent(msg)}${viewQuery}`
      : `/vehicles/${vehicleId ?? ""}?error=${encodeURIComponent(msg)}&tab=Fuel+Logs`;

  if (!validated.success) redirect(errorBack("Invalid fuel entry"));

  const supabase = requireAdminClient();
  const { data: existing, error: readError } = await supabase
    .from("vehicle_fuel_logs")
    .select("id, vehicle_id, log_date")
    .eq("id", validated.data.log_id)
    .maybeSingle();

  if (readError) throw new Error("Failed to load fuel entry: " + readError.message);
  if (!existing) redirect(errorBack("Fuel entry not found"));

  const vehicleId = existing.vehicle_id as string;
  const vehicle = await getVehicle(vehicleId, profile);
  if (!vehicle || !canEditVehicle(profile, vehicle, lookups)) {
    redirect(errorBack("You don't have access to this fuel entry", vehicleId));
  }

  const { error } = await supabase.from("vehicle_fuel_logs").delete().eq("id", validated.data.log_id);
  if (error) throw new Error("Failed to delete fuel entry: " + error.message);

  // The fill that followed this one now measures from an earlier fill.
  await resetFuelSegments(supabase, vehicleId, existing.log_date as string, existing.log_date as string);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/fuel");
  revalidatePath("/fuel-log");
  revalidatePath("/fuel-log/add");
  redirect(
    fromAddPage
      ? `/fuel-log/add?deleted=${encodeURIComponent(vehicle.registration_no)}${viewQuery}`
      : `/vehicles/${vehicleId}?fueldeleted=1&tab=Fuel+Logs`,
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
  if (!canAccessLocation(profile, { circleId: data.circle_id, divisionId: data.division_id }, lookups)) {
    throw new Error("Unauthorized access to this location");
  }

  const supabase = requireAdminClient();
  const { error } = await supabase.from("drivers").insert(data);

  if (error) throw new Error("Failed to create driver: " + error.message);

  revalidatePath("/drivers");
  revalidatePath("/alerts");
  redirect("/drivers?created=1");
}

