export const VEHICLE_STATUSES = [
  "active",
  "maintenance",
  "breakdown",
  "removed",
  "standby",
  "accident",
] as const;

export const DRIVER_SHIFTS = ["shift_a", "shift_b", "shift_c"] as const;
export const FUEL_OWNERSHIPS = ["company", "vendor"] as const;
export const DRIVER_OWNERSHIPS = ["company", "vendor"] as const;
export const USER_ROLES = [
  "super_admin",
  "zonal_manager",
  "circle_incharge",
  "division_incharge",
  "viewer",
] as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  zonal_manager: "Admin",
  circle_incharge: "Circle Incharge",
  division_incharge: "Division User",
  viewer: "Viewer",
};

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];
export type DriverShift = (typeof DRIVER_SHIFTS)[number];
export type FuelOwnership = (typeof FUEL_OWNERSHIPS)[number];
export type DriverOwnership = (typeof DRIVER_OWNERSHIPS)[number];
export type UserRole = (typeof USER_ROLES)[number];

export type Zone = {
  id: string;
  name: string;
};

export type Circle = {
  id: string;
  name: string;
  zone_id?: string | null;
  state?: string | null;
  discom?: string | null;
  contract_ref?: string | null;
};

export type Division = {
  id: string;
  name: string;
  circle_id: string;
};

export type Substation = {
  id: string;
  name: string;
  division_id: string;
};

export type LookupData = {
  zones?: Zone[];
  circles: Circle[];
  divisions: Division[];
  substations: Substation[];
};

export type UserProfile = {
  id: string;
  name: string;
  role: UserRole;
  circle_id: string | null;
  division_id: string | null;
  zone_id: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminUserRow = UserProfile & {
  email: string | null;
  last_sign_in_at: string | null;
};

export type FleetVehicle = {
  vehicle_id: string;
  registration_no: string;
  frt_no: string | null;
  vehicle_type: string | null;
  fuel_type: string | null;
  fuel_ownership: FuelOwnership;
  driver_ownership: DriverOwnership;
  model_year: number | null;
  owner_name: string | null;
  owner_mobile: string | null;
  vendor_name: string | null;
  vendor_mobile: string | null;
  gps_company: string | null;
  gps_device_id: string | null;
  home_circle_id: string;
  home_circle: string;
  insurance_expiry: string | null;
  fitness_expiry: string | null;
  pollution_expiry: string | null;
  rc_copy_url?: string | null;
  status: VehicleStatus;
  notes: string | null;
  assignment_id?: string | null;
  current_circle_id: string | null;
  current_circle: string | null;
  division_id: string | null;
  division: string | null;
  substation_id: string | null;
  substation: string | null;
  assigned_from: string | null;
  assigned_by?: string | null;
};

export type CircleSummary = {
  circle_id: string;
  circle: string;
  total: number;
  active: number;
  maintenance: number;
  breakdown: number;
  standby: number;
  documents_expiring: number;
};

export type DivisionSummary = {
  circle_id: string;
  circle: string;
  division_id: string;
  division: string;
  total: number;
  active: number;
  maintenance: number;
  breakdown: number;
  standby: number;
};

export type TransferRecord = {
  id: string;
  vehicle_id: string;
  registration_no: string;
  transfer_date: string;
  reason: string | null;
  approved_by: string | null;
  remarks: string | null;
  is_cross_circle: boolean;
  from_circle_id: string | null;
  from_circle: string | null;
  from_division_id: string | null;
  from_division: string | null;
  from_substation_id: string | null;
  from_substation: string | null;
  to_circle_id: string | null;
  to_circle: string | null;
  to_division_id: string | null;
  to_division: string | null;
  to_substation_id: string | null;
  to_substation: string | null;
  created_at?: string | null;
};

export type DriverRecord = {
  driver_id: string;
  name: string;
  mobile: string | null;
  license_no: string | null;
  license_expiry: string | null;
  address: string | null;
  status: "active" | "inactive";
  circle_id: string;
  circle: string;
  vehicle_id: string | null;
  registration_no: string | null;
  shift: DriverShift | null;
  assigned_from: string | null;
};

export type ActivityItem = {
  id: string;
  activity_type: "transfer" | "status";
  created_at: string;
  vehicle_id: string;
  registration_no: string;
  circle_id: string | null;
  division_id: string | null;
  description: string;
};

export type DriverAssignment = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  driver_name: string;
  mobile: string | null;
  license_no: string | null;
  shift: DriverShift;
  from_date: string;
  to_date: string | null;
  remarks: string | null;
};

export type StatusHistoryItem = {
  id: string;
  vehicle_id: string;
  status: VehicleStatus;
  remarks: string | null;
  from_date: string;
  to_date: string | null;
  recorded_by: string | null;
};

export type FuelOwnershipHistoryItem = {
  id: string;
  vehicle_id: string;
  ownership: FuelOwnership;
  remarks: string | null;
  from_date: string;
  to_date: string | null;
  changed_by: string | null;
};

export type DriverOwnershipHistoryItem = {
  id: string;
  vehicle_id: string;
  ownership: DriverOwnership;
  remarks: string | null;
  from_date: string;
  to_date: string | null;
  changed_by: string | null;
};

export type GpsDistanceMonth = {
  id: string;
  vehicle_id: string;
  year_month: string; // 'YYYY-MM'
  distance_km: number;
  synced_at: string;
  created_at?: string;
};

export const FUEL_LOG_TYPES = ["CNG", "Petrol", "Diesel"] as const;
export type FuelLogType = (typeof FUEL_LOG_TYPES)[number];

export type FuelLogEntry = {
  id: string;
  vehicle_id: string;
  log_date: string;
  logged_at?: string | null; // optional approximate fill instant (ISO); improves GPS-segment accuracy
  fuel_type: FuelLogType | null;
  fuel_litres: number;
  fuel_amount: number | null;
  gps_distance_km: number | null;
  gps_synced_at: string | null;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
};

export type VehicleHistoryItem = {
  id: string;
  vehicle_id: string;
  registration_no: string;
  event_date: string;
  event_type: "transfer" | "status";
  category: string;
  from_location: string | null;
  to_location: string | null;
  status: VehicleStatus | null;
  reason: string | null;
  approved_or_recorded_by: string | null;
  remarks: string | null;
  is_cross_circle: boolean;
};

// ── Live GPS tracking (Millitrack userDevicesState) ──────────────────────────
// The provider buckets every device into exactly one of these live states.
export const LIVE_STATUSES = [
  "running",
  "idle",
  "stopped",
  "inactive",
  "noData",
  "expired",
  "expiringSoon",
] as const;
export type LiveStatus = (typeof LIVE_STATUSES)[number];

export type FleetLiveCounts = Record<LiveStatus, number> & { total: number };

/** Which GPS platform a live record came from. */
export type LiveProvider = "VehicleStep" | "WheelsEye";

/**
 * One vehicle's live position/status — a GPS device joined to a VMS vehicle.
 * Fields are nullable because providers differ: Millitrack (VehicleStep) reports
 * speed/address/charge/blocked, while WheelsEye's server API only gives
 * status/location/ignition (speed & address there come from the web DOM, which we
 * can't read server-side). `null` means "this provider doesn't report it".
 */
export type LiveVehicleStatus = {
  vehicle_id: string;
  registration_no: string;
  frt_no: string | null;
  circle: string | null;
  division: string | null;
  substation: string | null;
  provider: LiveProvider;
  device_id: number;
  device_name: string | null;
  live_status: LiveStatus;
  speed_kmh: number | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  ignition: boolean | null;
  charge: boolean | null;
  blocked: boolean | null;
  today_distance_km: number | null;
  course: number | null;
  last_update: string | null; // ISO
};

/** Permission-scoped live snapshot for the /live page. */
export type FleetLiveStatus = {
  configured: boolean; // GPS provider credentials present
  ok: boolean; // live fetch succeeded
  error?: string;
  counts: FleetLiveCounts; // computed over the visible vehicles only
  vehicles: LiveVehicleStatus[];
  untracked: number; // visible GPS-mapped vehicles missing from the live feed
  fetchedAt: string; // ISO instant the snapshot was taken
};
