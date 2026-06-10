import { cache } from "react";
import {
  buildCircleSummaries,
  buildDivisionSummaries,
  mockActivity,
  mockDriverAssignments,
  mockDriverOwnershipHistory,
  mockDrivers,
  mockFuelLogs,
  mockFuelOwnershipHistory,
  mockLookups,
  mockStatusHistory,
  mockTransfers,
  mockVehicles,
} from "@/lib/mock-data";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { accessibleCircleIds, accessibleDivisionIds, canSeeVehicle, filterLookupsForProfile } from "@/lib/permissions";
import {
  DRIVER_SHIFTS,
  type ActivityItem,
  type AdminUserRow,
  type Circle,
  type CircleSummary,
  type Division,
  type DivisionSummary,
  type DriverAssignment,
  type DriverOwnershipHistoryItem,
  type DriverRecord,
  type DriverShift,
  type FleetVehicle,
  type FuelLogEntry,
  type FuelOwnershipHistoryItem,
  type LookupData,
  type StatusHistoryItem,
  type GpsDistanceMonth,
  type Substation,
  type TransferRecord,
  type UserProfile,
  type VehicleHistoryItem,
} from "@/lib/types";
import { getWorstDocumentState } from "@/lib/utils/expiry";

async function selectRows<T>(view: string, fallback: T[], orderColumn?: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback;

  let query = supabase.from(view as never).select("*");
  if (orderColumn) {
    query = query.order(orderColumn, { ascending: false }) as typeof query;
  }

  const { data, error } = await query;
  if (error) {
    console.error(`[data.ts] Query on "${view}" failed:`, error.message);
    return fallback;
  }
  if (!data) return fallback;

  return data as T[];
}

// Zero-arg cached raw fetchers. Keeping the cache() on the profile-independent
// query (rather than only on the profile-keyed wrapper) means the DB round trip
// dedupes across callers AND can be started before the profile is known.
const fetchVehicles = cache(() => selectRows<FleetVehicle>("vehicle_current_view", mockVehicles, "registration_no"));
const fetchTransfers = cache(() => selectRows<TransferRecord>("transfer_history_view", mockTransfers, "transfer_date"));
const fetchStatusHistory = cache(() => selectRows<StatusHistoryItem>("vehicle_status_history", mockStatusHistory, "from_date"));
const fetchDrivers = cache(() => selectRows<DriverRecord>("driver_current_view", mockDrivers, "name"));
const fetchActivity = cache(() => selectRows<ActivityItem>("activity_feed_view", mockActivity, "created_at"));

function warm(promise: Promise<unknown>) {
  // Fire-and-forget: the cached promise is awaited later by the real callers.
  promise.catch(() => {});
}

// Preload helpers — call BEFORE `await requireProfile()` so these queries run in
// parallel with the auth round trips instead of after them. The profile is only
// used to filter rows in JS, so the raw fetches never need to wait for it.
export function preloadFleetData() {
  warm(fetchVehicles());
  warm(getAllLookups());
}

export function preloadHistoryData() {
  warm(fetchTransfers());
  warm(fetchStatusHistory());
}

export function preloadDriverData() {
  warm(fetchDrivers());
}

export function preloadActivityData() {
  warm(fetchActivity());
}

export const getAllLookups = cache(async (): Promise<LookupData> => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return mockLookups;

  const [zones, circles, divisions, substations] = await Promise.all([
    supabase.from("zones").select("id,name").order("name"),
    supabase.from("circles").select("id,name,zone_id,state,discom,contract_ref").order("name"),
    supabase.from("divisions").select("id,name,circle_id").order("name"),
    supabase.from("substations").select("id,name,division_id").order("name"),
  ]);

  if (zones.error || circles.error || divisions.error || substations.error) return mockLookups;

  return {
    zones: (zones.data ?? []) as LookupData["zones"],
    circles: (circles.data ?? []) as Circle[],
    divisions: (divisions.data ?? []) as Division[],
    substations: (substations.data ?? []) as Substation[],
  };
});

export async function getLookups(profile?: UserProfile | null): Promise<LookupData> {
  const lookups = await getAllLookups();
  return profile ? filterLookupsForProfile(lookups, profile) : lookups;
}

export const getVehicles = cache(async (profile?: UserProfile | null): Promise<FleetVehicle[]> => {
  const vehicles = await fetchVehicles();
  if (!profile) return vehicles;

  const lookups = await getAllLookups();
  return vehicles.filter((vehicle) => canSeeVehicle(profile, vehicle, lookups));
});

export async function getVehicle(id: string, profile?: UserProfile | null) {
  const vehicles = await getVehicles(profile);
  return vehicles.find((vehicle) => vehicle.vehicle_id === id || vehicle.registration_no === decodeURIComponent(id));
}

function buildCircleSummariesFrom(vehicles: FleetVehicle[], lookups: LookupData): CircleSummary[] {
  return lookups.circles.map((circle) => {
    const rows = vehicles.filter(
      (vehicle) =>
        vehicle.status !== "removed" &&
        (vehicle.home_circle_id === circle.id || vehicle.current_circle_id === circle.id),
    );

    return {
      circle_id: circle.id,
      circle: circle.name,
      total: rows.length,
      active: rows.filter((row) => row.status === "active").length,
      maintenance: rows.filter((row) => row.status === "maintenance").length,
      breakdown: rows.filter((row) => row.status === "breakdown").length,
      standby: rows.filter((row) => row.status === "standby").length,
      documents_expiring: rows.filter((row) =>
        ["expiring", "expired"].includes(
          getWorstDocumentState([row.insurance_expiry, row.fitness_expiry, row.pollution_expiry]),
        ),
      ).length,
    };
  });
}

function buildDivisionSummariesFrom(vehicles: FleetVehicle[], lookups: LookupData): DivisionSummary[] {
  return lookups.divisions.map((division) => {
    const circle = lookups.circles.find((item) => item.id === division.circle_id);
    const rows = vehicles.filter((vehicle) => vehicle.division_id === division.id && vehicle.status !== "removed");

    return {
      circle_id: division.circle_id,
      circle: circle?.name ?? "Unknown",
      division_id: division.id,
      division: division.name,
      total: rows.length,
      active: rows.filter((row) => row.status === "active").length,
      maintenance: rows.filter((row) => row.status === "maintenance").length,
      breakdown: rows.filter((row) => row.status === "breakdown").length,
      standby: rows.filter((row) => row.status === "standby").length,
    };
  });
}

export async function getCircleSummaries(profile?: UserProfile | null): Promise<CircleSummary[]> {
  if (profile && profile.role !== "super_admin") {
    const [vehicles, lookups] = await Promise.all([getVehicles(profile), getLookups(profile)]);
    return buildCircleSummariesFrom(vehicles, lookups).filter((row) => row.total > 0 || row.circle_id === profile.circle_id);
  }

  const rows = await selectRows<CircleSummary>("circle_fleet_summary", [], "circle");
  if (rows.length > 0) return rows;
  return buildCircleSummaries(await getVehicles(profile));
}

export async function getDivisionSummaries(profile?: UserProfile | null): Promise<DivisionSummary[]> {
  if (profile && profile.role !== "super_admin") {
    const [vehicles, lookups] = await Promise.all([getVehicles(profile), getLookups(profile)]);
    return buildDivisionSummariesFrom(vehicles, lookups);
  }

  const rows = await selectRows<DivisionSummary>("division_fleet_summary", [], "division");
  if (rows.length > 0) return rows;
  return buildDivisionSummaries(await getVehicles(profile));
}

export const getTransfers = cache(async (profile?: UserProfile | null): Promise<TransferRecord[]> => {
  const transfers = await fetchTransfers();
  if (!profile) return transfers;

  const lookups = await getAllLookups();
  const circleIds = accessibleCircleIds(profile, lookups);
  const divisionIds = accessibleDivisionIds(profile, lookups);

  return transfers.filter(
    (transfer) =>
      (transfer.from_circle_id ? circleIds.has(transfer.from_circle_id) : false) ||
      (transfer.to_circle_id ? circleIds.has(transfer.to_circle_id) : false) ||
      (transfer.from_division_id ? divisionIds.has(transfer.from_division_id) : false) ||
      (transfer.to_division_id ? divisionIds.has(transfer.to_division_id) : false),
  );
});

export async function getDrivers(profile?: UserProfile | null): Promise<DriverRecord[]> {
  const drivers = await fetchDrivers();
  if (!profile) return drivers;

  const lookups = await getAllLookups();
  const circleIds = accessibleCircleIds(profile, lookups);
  const vehicles = await getVehicles(profile);
  const visibleVehicleIds = new Set(vehicles.map((vehicle) => vehicle.vehicle_id));

  // Circle-level roles see every driver in their circle(s); division-level roles
  // have no circle access, so they only see drivers assigned to a visible vehicle.
  return drivers.filter(
    (driver) =>
      circleIds.has(driver.circle_id) ||
      (driver.vehicle_id ? visibleVehicleIds.has(driver.vehicle_id) : false),
  );
}

export async function getActivity(profile?: UserProfile | null): Promise<ActivityItem[]> {
  const rows = await fetchActivity();
  if (!profile) return rows.slice(0, 10);

  const lookups = await getAllLookups();
  const circleIds = accessibleCircleIds(profile, lookups);
  const divisionIds = accessibleDivisionIds(profile, lookups);

  return rows
    .filter(
      (item) =>
        (item.circle_id ? circleIds.has(item.circle_id) : false) ||
        (item.division_id ? divisionIds.has(item.division_id) : false),
    )
    .slice(0, 10);
}

export async function getDriverAssignments(vehicleId: string, profile?: UserProfile | null): Promise<DriverAssignment[]> {
  if (profile) {
    const vehicle = await getVehicle(vehicleId, profile);
    if (!vehicle) return [];
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return mockDriverAssignments.filter((item) => item.vehicle_id === vehicleId);

  const { data, error } = await supabase
    .from("driver_assignments")
    .select("id,vehicle_id,driver_id,shift,from_date,to_date,remarks,drivers(name,mobile,license_no)")
    .eq("vehicle_id", vehicleId)
    .order("from_date", { ascending: false });

  if (error || !data) return mockDriverAssignments.filter((item) => item.vehicle_id === vehicleId);

  return data.map((row) => {
    const driver = Array.isArray(row.drivers) ? row.drivers[0] : row.drivers;
    return {
      id: row.id,
      vehicle_id: row.vehicle_id,
      driver_id: row.driver_id,
      driver_name: driver?.name ?? "Unknown driver",
      mobile: driver?.mobile ?? null,
      license_no: driver?.license_no ?? null,
      shift: row.shift as DriverAssignment["shift"],
      from_date: row.from_date,
      to_date: row.to_date,
      remarks: row.remarks,
    };
  });
}

async function getCurrentDriverAssignmentsForVehicles(vehicleIds: string[]) {
  if (vehicleIds.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return mockDriverAssignments.filter((item) => vehicleIds.includes(item.vehicle_id) && !item.to_date);
  }

  const { data, error } = await supabase
    .from("driver_assignments")
    .select("id,vehicle_id,driver_id,shift,from_date,to_date,remarks,drivers(name,mobile,license_no)")
    .in("vehicle_id", vehicleIds)
    .is("to_date", null);

  if (error || !data) {
    return mockDriverAssignments.filter((item) => vehicleIds.includes(item.vehicle_id) && !item.to_date);
  }

  return data.map((row) => {
    const driver = Array.isArray(row.drivers) ? row.drivers[0] : row.drivers;
    return {
      id: row.id,
      vehicle_id: row.vehicle_id,
      driver_id: row.driver_id,
      driver_name: driver?.name ?? "Unknown driver",
      mobile: driver?.mobile ?? null,
      license_no: driver?.license_no ?? null,
      shift: row.shift as DriverAssignment["shift"],
      from_date: row.from_date,
      to_date: row.to_date,
      remarks: row.remarks,
    };
  });
}

export async function getStatusHistory(vehicleId: string, profile?: UserProfile | null): Promise<StatusHistoryItem[]> {
  if (profile) {
    const vehicle = await getVehicle(vehicleId, profile);
    if (!vehicle) return [];
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return mockStatusHistory.filter((row) => row.vehicle_id === vehicleId);

  const { data, error } = await supabase
    .from("vehicle_status_history")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("from_date", { ascending: false });

  if (error) {
    console.error("[data.ts] getStatusHistory failed:", error.message);
    return [];
  }
  return (data ?? []) as StatusHistoryItem[];
}

export async function getGpsDistanceHistory(vehicleId: string, profile?: UserProfile | null): Promise<GpsDistanceMonth[]> {
  if (profile) {
    const vehicle = await getVehicle(vehicleId, profile);
    if (!vehicle) return [];
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("vehicle_gps_distance")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("year_month", { ascending: false });

  if (error) {
    console.error("[data.ts] getGpsDistanceHistory failed:", error.message);
    return [];
  }
  return (data ?? []) as GpsDistanceMonth[];
}

/** Monthly GPS distance for every vehicle in a given month (for the fuel dashboard KM column). */
export const getGpsDistanceForMonth = cache(
  async (yearMonth: string): Promise<{ vehicle_id: string; distance_km: number }[]> => {
    const supabase = createSupabaseAdminClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("vehicle_gps_distance")
      .select("vehicle_id,distance_km")
      .eq("year_month", yearMonth);

    if (error) {
      console.error("[data.ts] getGpsDistanceForMonth failed:", error.message);
      return [];
    }
    return (data ?? []) as { vehicle_id: string; distance_km: number }[];
  },
);

export async function getFuelOwnershipHistory(vehicleId: string, profile?: UserProfile | null): Promise<FuelOwnershipHistoryItem[]> {
  if (profile) {
    const vehicle = await getVehicle(vehicleId, profile);
    if (!vehicle) return [];
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return mockFuelOwnershipHistory.filter((row) => row.vehicle_id === vehicleId);

  const { data, error } = await supabase
    .from("vehicle_fuel_ownership_history")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("from_date", { ascending: false });

  if (error) {
    console.error("[data.ts] getFuelOwnershipHistory failed:", error.message);
    return [];
  }
  return (data ?? []) as FuelOwnershipHistoryItem[];
}

export async function getDriverOwnershipHistory(vehicleId: string, profile?: UserProfile | null): Promise<DriverOwnershipHistoryItem[]> {
  if (profile) {
    const vehicle = await getVehicle(vehicleId, profile);
    if (!vehicle) return [];
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return mockDriverOwnershipHistory.filter((row) => row.vehicle_id === vehicleId);

  const { data, error } = await supabase
    .from("vehicle_driver_ownership_history")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("from_date", { ascending: false });

  if (error) {
    console.error("[data.ts] getDriverOwnershipHistory failed:", error.message);
    return [];
  }
  return (data ?? []) as DriverOwnershipHistoryItem[];
}

export async function getFuelLogs(vehicleId: string, profile?: UserProfile | null): Promise<FuelLogEntry[]> {
  if (profile) {
    const vehicle = await getVehicle(vehicleId, profile);
    if (!vehicle) return [];
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return mockFuelLogs.filter((row) => row.vehicle_id === vehicleId);

  const { data, error } = await supabase
    .from("vehicle_fuel_logs")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("log_date", { ascending: false });

  if (error) {
    console.error("[data.ts] getFuelLogs failed:", error.message);
    return [];
  }
  return (data ?? []) as FuelLogEntry[];
}

const fetchFuelLogsForMonth = cache(async (month: string): Promise<FuelLogEntry[]> => {
  const from = `${month}-01`;
  // Last day of month: go to first of next month minus 1
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return mockFuelLogs.filter((l) => l.log_date >= from && l.log_date <= to);
  }

  const { data, error } = await supabase
    .from("vehicle_fuel_logs")
    .select("*")
    .gte("log_date", from)
    .lte("log_date", to)
    .order("log_date", { ascending: false });

  if (error) {
    console.error("[data.ts] getFuelLogsForMonth failed:", error.message);
    return [];
  }

  return (data ?? []) as FuelLogEntry[];
});

export function preloadFuelMonthData(yearMonth: string) {
  warm(fetchFuelLogsForMonth(yearMonth));
  warm(getGpsDistanceForMonth(yearMonth));
}

export async function getFuelLogsForMonth(
  profile?: UserProfile | null,
  yearMonth?: string,
): Promise<FuelLogEntry[]> {
  const month = yearMonth ?? new Date().toISOString().slice(0, 7);
  const allLogs = await fetchFuelLogsForMonth(month);
  if (!profile) return allLogs;

  const vehicles = await getVehicles(profile);
  const ids = new Set(vehicles.map((v) => v.vehicle_id));
  return allLogs.filter((l) => ids.has(l.vehicle_id));
}

export const getAllStatusHistory = cache(async (profile?: UserProfile | null): Promise<StatusHistoryItem[]> => {
  const rows = await fetchStatusHistory();
  if (!profile) return rows;

  const vehicles = await getVehicles(profile);
  const visibleVehicleIds = new Set(vehicles.map((vehicle) => vehicle.vehicle_id));
  return rows.filter((row) => visibleVehicleIds.has(row.vehicle_id));
});

export async function getVehicleTransfers(vehicleId: string, profile?: UserProfile | null): Promise<TransferRecord[]> {
  const transfers = await getTransfers(profile);
  return transfers.filter((transfer) => transfer.vehicle_id === vehicleId);
}

function location(parts: Array<string | null | undefined>) {
  const value = parts.filter(Boolean).join(" / ");
  return value || null;
}

function statusCategory(status: StatusHistoryItem["status"]) {
  if (status === "removed") return "Permanent Removed";
  if (status === "standby") return "Temporary Removed / Standby";
  if (status === "maintenance") return "Temporary Removed / Maintenance";
  if (status === "breakdown") return "Temporary Removed / Breakdown";
  if (status === "accident") return "Temporary Removed / Accident";
  return "Status Restored / Active";
}

export async function getVehicleHistory(profile?: UserProfile | null): Promise<VehicleHistoryItem[]> {
  const [vehicles, transfers, statuses] = await Promise.all([
    getVehicles(profile),
    getTransfers(profile),
    getAllStatusHistory(profile),
  ]);

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.vehicle_id, vehicle]));

  const transferItems: VehicleHistoryItem[] = transfers.map((transfer) => ({
    id: `transfer-${transfer.id}`,
    vehicle_id: transfer.vehicle_id,
    registration_no: transfer.registration_no,
    event_date: transfer.transfer_date,
    event_type: "transfer",
    category: transfer.is_cross_circle ? "Cross-Circle Movement" : "Substation Movement",
    from_location: location([transfer.from_circle, transfer.from_division, transfer.from_substation]),
    to_location: location([transfer.to_circle, transfer.to_division, transfer.to_substation]),
    status: null,
    reason: transfer.reason,
    approved_or_recorded_by: transfer.approved_by,
    remarks: transfer.remarks,
    is_cross_circle: transfer.is_cross_circle,
  }));

  const statusItems: VehicleHistoryItem[] = statuses.map((status) => {
    const vehicle = vehicleById.get(status.vehicle_id);

    return {
      id: `status-${status.id}`,
      vehicle_id: status.vehicle_id,
      registration_no: vehicle?.registration_no ?? "Unknown vehicle",
      event_date: status.from_date,
      event_type: "status",
      category: statusCategory(status.status),
      from_location: location([vehicle?.current_circle, vehicle?.division, vehicle?.substation]),
      to_location: null,
      status: status.status,
      reason: statusCategory(status.status),
      approved_or_recorded_by: status.recorded_by,
      remarks: status.remarks,
      is_cross_circle: false,
    };
  });

  return [...transferItems, ...statusItems].sort((a, b) => {
    const dateCompare = b.event_date.localeCompare(a.event_date);
    if (dateCompare !== 0) return dateCompare;
    return a.registration_no.localeCompare(b.registration_no);
  });
}

export async function getDashboardData(profile?: UserProfile | null) {
  const [vehicles, circles, divisions, drivers, activity] = await Promise.all([
    getVehicles(profile),
    getCircleSummaries(profile),
    getDivisionSummaries(profile),
    getDrivers(profile),
    getActivity(profile),
  ]);

  const visibleVehicles = vehicles.filter((vehicle) => vehicle.status !== "removed");

  return {
    vehicles,
    circles,
    divisions,
    activity,
    summary: {
      totalCircles: circles.length,
      totalVehicles: visibleVehicles.length,
      activeVehicles: visibleVehicles.filter((vehicle) => vehicle.status === "active").length,
      maintenanceOrBreakdown: visibleVehicles.filter((vehicle) => ["maintenance", "breakdown"].includes(vehicle.status)).length,
      expiringDocs: visibleVehicles.filter((vehicle) =>
        ["expiring", "expired"].includes(
          getWorstDocumentState([vehicle.insurance_expiry, vehicle.fitness_expiry, vehicle.pollution_expiry]),
        ),
      ).length,
      activeDrivers: drivers.filter((driver) => driver.status === "active").length,
    },
  };
}

export async function getAlertsData(profile?: UserProfile | null) {
  const [vehicles, drivers] = await Promise.all([getVehicles(profile), getDrivers(profile)]);
  const assignments = await getCurrentDriverAssignmentsForVehicles(vehicles.map((vehicle) => vehicle.vehicle_id));

  const documentAlerts = vehicles.filter((vehicle) =>
    ["expiring", "expired"].includes(
      getWorstDocumentState([vehicle.insurance_expiry, vehicle.fitness_expiry, vehicle.pollution_expiry]),
    ),
  );

  const driverLicenseAlerts = drivers.filter((driver) =>
    ["expiring", "expired"].includes(getWorstDocumentState([driver.license_expiry])),
  );

  const vehiclesWithoutAllDrivers = vehicles
    .filter((vehicle) => {
      const activeAssignments = assignments.filter((a) => a.vehicle_id === vehicle.vehicle_id && !a.to_date);
      const shifts = new Set(activeAssignments.map((a) => a.shift));
      return vehicle.status !== "removed" && shifts.size < 3;
    })
    .map((vehicle) => {
      const activeAssignments = assignments.filter((a) => a.vehicle_id === vehicle.vehicle_id && !a.to_date);
      const filledShifts = new Set(activeAssignments.map((a) => a.shift));
      const missingShifts = (DRIVER_SHIFTS as readonly DriverShift[]).filter((s) => !filledShifts.has(s));
      return { ...vehicle, missingShifts };
    });

  return { documentAlerts, driverLicenseAlerts, vehiclesWithoutAllDrivers };
}

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];

  const [{ data: profiles }, usersResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id,name,role,circle_id,division_id,zone_id,is_active,created_at,updated_at")
      .order("created_at", { ascending: false }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const users = usersResult.data?.users ?? [];

  return ((profiles ?? []) as UserProfile[]).map((profile) => {
    const authUser = users.find((user) => user.id === profile.id);
    return {
      ...profile,
      email: authUser?.email ?? null,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
    };
  });
}
