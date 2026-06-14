import { z } from "zod";

export const vehicleSchema = z.object({
  registration_no: z.string().min(4, "Registration number is too short").max(15).toUpperCase(),
  frt_no: z.string().optional().nullable(),
  vehicle_type: z.string().min(1, "Vehicle type is required"),
  fuel_type: z.enum(["Diesel", "Petrol", "CNG", "EV"]),
  fuel_ownership: z.enum(["company", "vendor"]).default("company"),
  driver_ownership: z.enum(["company", "vendor"]).default("company"),
  model_year: z.coerce.number().min(1990).max(2035).optional().nullable(),
  owner_name: z.string().optional().nullable(),
  owner_mobile: z.string().regex(/^[0-9]{10}$/, "Mobile must be 10 digits").optional().nullable().or(z.literal("")),
  vendor_name: z.string().optional().nullable(),
  vendor_mobile: z.string().regex(/^[0-9]{10}$/, "Mobile must be 10 digits").optional().nullable().or(z.literal("")),
  gps_company: z.string().optional().nullable(),
  gps_device_id: z.string().optional().nullable(),
  circle_id: z.string().uuid("Invalid circle"),
  insurance_expiry: z.string().optional().nullable().or(z.literal("")),
  fitness_expiry: z.string().optional().nullable().or(z.literal("")),
  pollution_expiry: z.string().optional().nullable().or(z.literal("")),
  status: z.enum(['active', 'maintenance', 'breakdown', 'removed', 'standby', 'accident']).default('active'),
  notes: z.string().optional().nullable(),
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
});

export const statusSchema = z.object({
  vehicle_id: z.string().uuid(),
  status: z.enum(['active', 'maintenance', 'breakdown', 'removed', 'standby', 'accident']),
  from_date: z.string().min(1, "Date is required"),
  remarks: z.string().optional().nullable(),
});

export const driverSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: z.string().regex(/^[0-9]{10}$/, "Mobile must be 10 digits").optional().nullable().or(z.literal("")),
  license_no: z.string().optional().nullable(),
  license_expiry: z.string().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  circle_id: z.string().uuid("Invalid circle"),
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
