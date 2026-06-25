import { z } from "zod";

// HTML form fields always submit a value — a blank input arrives as "" (never
// undefined). Writing "" to a date/integer column throws ("invalid input syntax
// for type date"), and for text columns it stores an empty string instead of NULL.
// These helpers normalise blank → null so optional columns stay clean and the
// create/update/driver actions can spread the parsed object straight into the DB.
//   - "" or whitespace-only  → null
//   - absent (undefined)     → undefined (so .partial() updates omit the column)
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const optionalText = z.preprocess(emptyToNull, z.string().trim().nullable()).optional();
const optionalMobile = z
  .preprocess(emptyToNull, z.string().regex(/^[0-9]{10}$/, "Mobile must be 10 digits").nullable())
  .optional();
const optionalDate = z.preprocess(emptyToNull, z.string().nullable()).optional();
const optionalYear = z
  .preprocess(emptyToNull, z.coerce.number().int().min(1990, "Year must be 1990 or later").max(2035, "Year is too far in the future").nullable())
  .optional();

export const vehicleSchema = z.object({
  registration_no: z.string().min(4, "Registration number is too short").max(15).toUpperCase(),
  // frt_no is no longer a vehicle field — FRT denotes the substation/posting and is
  // managed in Admin → Substation FRT Numbers; the view derives it per vehicle.
  vehicle_type: z.string().min(1, "Vehicle type is required"),
  fuel_type: z.enum(["Diesel", "Petrol", "CNG", "EV"]),
  fuel_ownership: z.enum(["company", "vendor"]).default("company"),
  driver_ownership: z.enum(["company", "vendor"]).default("company"),
  model_year: optionalYear,
  owner_name: optionalText,
  owner_mobile: optionalMobile,
  vendor_name: optionalText,
  vendor_mobile: optionalMobile,
  gps_company: optionalText,
  gps_device_id: optionalText,
  circle_id: z.string().uuid("Invalid circle"),
  insurance_expiry: optionalDate,
  fitness_expiry: optionalDate,
  pollution_expiry: optionalDate,
  status: z.enum(['active', 'maintenance', 'breakdown', 'removed', 'standby', 'accident']).default('active'),
  notes: optionalText,
});

export const transferSchema = z.object({
  vehicle_id: z.string().uuid(),
  to_circle_id: z.string().uuid(),
  to_division_id: z.string().uuid(),
  to_substation_id: z.string().uuid(),
  transfer_date: z.string().min(1, "Date is required"),
  reason: z.string().min(1, "Reason is required"),
  approved_by: z.string().min(1, "Approver name is required"),
  remarks: z.string().optional().nullable(),
  // Checkbox: unchecked → field absent → false. Only when explicitly checked
  // does the driver follow the vehicle to the new substation.
  move_driver: z
    .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
    .default(false),
});

export const statusSchema = z.object({
  vehicle_id: z.string().uuid(),
  status: z.enum(['active', 'maintenance', 'breakdown', 'removed', 'standby', 'accident']),
  from_date: z.string().min(1, "Date is required"),
  remarks: z.string().optional().nullable(),
});

export const driverSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: optionalMobile,
  license_no: optionalText,
  license_expiry: optionalDate,
  address: optionalText,
  circle_id: z.string().uuid("Invalid circle"),
  division_id: z.string().uuid("Invalid division"),
  substation_id: z.string().uuid("Invalid substation"),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const fuelOwnershipSchema = z.object({
  vehicle_id: z.string().uuid(),
  ownership: z.enum(["company", "vendor"]),
  from_date: z.string().min(1, "Date is required"),
  remarks: z.string().optional().nullable(),
});

export const driverOwnershipSchema = z.object({
  vehicle_id: z.string().uuid(),
  ownership: z.enum(["company", "vendor"]),
  from_date: z.string().min(1, "Date is required"),
  remarks: z.string().optional().nullable(),
});

export const fuelLogSchema = z.object({
  vehicle_id: z.string().uuid(),
  log_date: z.string().min(1, "Date is required"),
  log_time: z.string().optional().nullable(), // optional HH:MM (IST); blank → date only
  fuel_type: z.enum(["CNG", "Petrol", "Diesel"], { message: "Select a fuel type" }),
  fuel_litres: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().positive("Litres must be greater than 0"),
  ),
  fuel_amount: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().min(0, "Amount must be 0 or more").nullable().optional(),
  ),
  notes: z.string().optional().nullable(),
});
