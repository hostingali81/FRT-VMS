"use client";

import { ChevronDown, ChevronUp, Edit3, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, DashedButton, LinkButton } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { ExpiryBadge } from "@/components/shared/ExpiryBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Timeline } from "@/components/shared/Timeline";
import { Badge } from "@/components/ui/badge";
import { QuickFuelForm } from "@/components/fuel/QuickFuelForm";
import type {
  DriverAssignment,
  DriverOwnershipHistoryItem,
  DriverRecord,
  FleetVehicle,
  FuelLogEntry,
  FuelOwnershipHistoryItem,
  StatusHistoryItem,
  TransferRecord,
} from "@/lib/types";
import { formatDate, titleCase } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type QuickAction = "status" | "fuel" | "driver" | null;
type ShiftKey = "shift_a" | "shift_b" | "shift_c";

const TABS = [
  "Overview",
  "Drivers",
  "Fuel Logs",
  "Transfers",
  "Status History",
  "Fuel History",
  "Driver History",
  "Driver Source",
  "Documents",
] as const;
type TabName = (typeof TABS)[number];

export function VehicleProfileTabs({
  vehicle,
  drivers,
  transfers,
  statusHistory,
  fuelLogs,
  fuelOwnershipHistory,
  driverOwnershipHistory,
  availableDrivers,
  canManage,
  defaultTab,
  changeStatusAction,
  changeFuelOwnershipAction,
  changeDriverOwnershipAction,
  replaceDriverAction,
  addFuelLogAction,
}: {
  vehicle: FleetVehicle;
  drivers: DriverAssignment[];
  transfers: TransferRecord[];
  statusHistory: StatusHistoryItem[];
  fuelLogs: FuelLogEntry[];
  fuelOwnershipHistory: FuelOwnershipHistoryItem[];
  driverOwnershipHistory: DriverOwnershipHistoryItem[];
  availableDrivers: DriverRecord[];
  canManage: boolean;
  defaultTab?: TabName;
  changeStatusAction: (formData: FormData) => Promise<void>;
  changeFuelOwnershipAction: (formData: FormData) => Promise<void>;
  changeDriverOwnershipAction: (formData: FormData) => Promise<void>;
  replaceDriverAction: (formData: FormData) => Promise<void>;
  addFuelLogAction: (formData: FormData) => Promise<void>;
}) {
  const [tab, setTab] = useState<TabName>(defaultTab ?? "Overview");
  const [openAction, setOpenAction] = useState<QuickAction>(null);
  const [openShift, setOpenShift] = useState<ShiftKey | null>(null);
  const [showFuelForm, setShowFuelForm] = useState(false);

  const currentDrivers = useMemo(() => drivers.filter((d) => !d.to_date), [drivers]);
  const activeAvailableDrivers = useMemo(
    () => availableDrivers.filter((d) => d.status === "active"),
    [availableDrivers],
  );

  const today = new Date().toISOString().slice(0, 10);

  // Newest first; avg = GPS distance (km since previous fill) / litres of this fill
  const fuelLogsWithDerived = useMemo(() => {
    return [...fuelLogs]
      .sort((a, b) => b.log_date.localeCompare(a.log_date))
      .map((log) => {
        const avg =
          log.gps_distance_km !== null && log.fuel_litres > 0
            ? +(log.gps_distance_km / log.fuel_litres).toFixed(1)
            : null;
        return { ...log, avg };
      });
  }, [fuelLogs]);

  const hasGpsDevice = Boolean(vehicle.gps_device_id);
  const anySynced = useMemo(() => fuelLogs.some((l) => l.gps_synced_at), [fuelLogs]);

  // Monthly summary for fuel logs (current calendar month)
  const currentMonthSummary = useMemo(() => {
    const monthStr = new Date().toISOString().slice(0, 7);
    const monthLogs = fuelLogs.filter((l) => l.log_date.startsWith(monthStr));
    return {
      entries: monthLogs.length,
      litres: monthLogs.reduce((sum, l) => sum + (l.fuel_litres ?? 0), 0),
      amount: monthLogs.reduce((sum, l) => sum + (l.fuel_amount ?? 0), 0),
    };
  }, [fuelLogs]);

  const isCompany = vehicle.fuel_ownership === "company";
  const canAddFuelLog = canManage && isCompany;
  const fuelVehicleOption = {
    vehicle_id: vehicle.vehicle_id,
    registration_no: vehicle.registration_no,
    division: vehicle.division ?? null,
    fuel_type: vehicle.fuel_type ?? null,
  };

  return (
    <div>
      {/* Mobile tab selector */}
      <div className="border-b border-slate-200 bg-white px-4 md:hidden">
        <Select
          value={tab}
          onChange={(e) => setTab(e.target.value as TabName)}
          className="my-3"
        >
          {TABS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      {/* Desktop tab bar */}
      <div className="hidden overflow-x-auto border-b border-slate-200 bg-white md:block">
        <div className="flex min-w-max px-4 sm:px-6 lg:px-8">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                t === tab
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 py-5 sm:px-6 lg:px-8">

        {/* ─── OVERVIEW ─── */}
        {tab === "Overview" && (
          <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">

            {/* Vehicle details */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Vehicle Details</CardTitle>
                  {canManage && (
                    <LinkButton
                      href={`/vehicles/${vehicle.vehicle_id}/edit`}
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </LinkButton>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                  <Field label="FRT No">{vehicle.frt_no ?? "—"}</Field>
                  <Field label="Type">{vehicle.vehicle_type ?? "—"}</Field>
                  <Field label="Fuel Type">{vehicle.fuel_type ?? "—"}</Field>
                  <Field label="Fuel By">
                    <Badge tone={vehicle.fuel_ownership === "vendor" ? "yellow" : "blue"}>
                      {vehicle.fuel_ownership === "vendor" ? "Vendor Fuel" : "Company Fuel"}
                    </Badge>
                  </Field>
                  <Field label="Driver By">
                    <Badge tone={vehicle.driver_ownership === "vendor" ? "yellow" : "blue"}>
                      {vehicle.driver_ownership === "vendor" ? "Vendor Driver" : "Company Driver"}
                    </Badge>
                  </Field>
                  <Field label="Status">
                    <StatusBadge status={vehicle.status} />
                  </Field>
                  <Field label="Model Year">{vehicle.model_year ? String(vehicle.model_year) : "—"}</Field>
                  <Field label="Owner">
                    {vehicle.owner_name ?? "—"}
                    {vehicle.owner_mobile && (
                      <span className="block text-xs text-slate-400">{vehicle.owner_mobile}</span>
                    )}
                  </Field>
                  <Field label="Vendor">{vehicle.vendor_name ?? "—"}</Field>
                  <Field label="GPS Company">
                    {vehicle.gps_company ?? "—"}
                    {vehicle.gps_device_id && (
                      <span className="block text-xs text-slate-400">{vehicle.gps_device_id}</span>
                    )}
                  </Field>
                  <Field label="Location" className="col-span-2 sm:col-span-1">
                    {vehicle.current_circle ?? vehicle.home_circle}
                    <span className="block text-xs text-slate-400">
                      {vehicle.division ?? "No division"} / {vehicle.substation ?? "No substation"}
                    </span>
                  </Field>
                </dl>
              </CardContent>
            </Card>

            {/* Right sidebar */}
            <div className="space-y-4">

              {/* Documents */}
              <Card>
                <CardHeader>
                  <CardTitle>Documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ExpiryBadge label="Insurance" date={vehicle.insurance_expiry} />
                  <ExpiryBadge label="Fitness" date={vehicle.fitness_expiry} />
                  <ExpiryBadge label="Pollution" date={vehicle.pollution_expiry} />
                </CardContent>
              </Card>

              {/* Admin actions — accordion */}
              {canManage && (
                <Card>
                  <CardHeader>
                    <CardTitle>Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-3">

                    {/* Change Status accordion */}
                    <div className="overflow-hidden rounded-md border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setOpenAction(openAction === "status" ? null : "status")}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Change Status
                        {openAction === "status" ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                      {openAction === "status" && (
                        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
                          <form action={changeStatusAction} className="space-y-3">
                            <input type="hidden" name="vehicle_id" value={vehicle.vehicle_id} />
                            <div className="space-y-1.5">
                              <Label>New Status</Label>
                              <Select name="status" required>
                                <option value="active">Active</option>
                                <option value="maintenance">Maintenance</option>
                                <option value="breakdown">Breakdown</option>
                                <option value="standby">Standby</option>
                                <option value="removed">Removed</option>
                                <option value="accident">Accident</option>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Effective Date</Label>
                              <Input name="from_date" type="date" defaultValue={today} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Remarks</Label>
                              <Textarea name="remarks" />
                            </div>
                            <SubmitButton className="w-full">Save</SubmitButton>
                          </form>
                        </div>
                      )}
                    </div>

                    {/* Change Fuel Ownership accordion */}
                    <div className="overflow-hidden rounded-md border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setOpenAction(openAction === "fuel" ? null : "fuel")}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Change Fuel Ownership
                        {openAction === "fuel" ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                      {openAction === "fuel" && (
                        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
                          <form action={changeFuelOwnershipAction} className="space-y-3">
                            <input type="hidden" name="vehicle_id" value={vehicle.vehicle_id} />
                            <div className="space-y-1.5">
                              <Label>Ownership</Label>
                              <Select name="ownership" defaultValue={vehicle.fuel_ownership} required>
                                <option value="company">Company Fuel</option>
                                <option value="vendor">Vendor Fuel</option>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Effective Date</Label>
                              <Input name="from_date" type="date" defaultValue={today} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Remarks</Label>
                              <Textarea name="remarks" />
                            </div>
                            <SubmitButton className="w-full">Save</SubmitButton>
                          </form>
                        </div>
                      )}
                    </div>

                    {/* Change Driver Source accordion */}
                    <div className="overflow-hidden rounded-md border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setOpenAction(openAction === "driver" ? null : "driver")}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Change Driver Source
                        {openAction === "driver" ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                      {openAction === "driver" && (
                        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
                          <form action={changeDriverOwnershipAction} className="space-y-3">
                            <input type="hidden" name="vehicle_id" value={vehicle.vehicle_id} />
                            <div className="space-y-1.5">
                              <Label>Driver By</Label>
                              <Select name="ownership" defaultValue={vehicle.driver_ownership} required>
                                <option value="company">Company Driver</option>
                                <option value="vendor">Vendor Driver</option>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Effective Date</Label>
                              <Input name="from_date" type="date" defaultValue={today} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Remarks</Label>
                              <Textarea name="remarks" />
                            </div>
                            <SubmitButton className="w-full">Save</SubmitButton>
                          </form>
                        </div>
                      )}
                    </div>

                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ─── DRIVERS ─── */}
        {tab === "Drivers" && (
          <div className="grid gap-4 md:grid-cols-3">
            {(["shift_a", "shift_b", "shift_c"] as const).map((shift) => {
              const driver = currentDrivers.find((d) => d.shift === shift);
              const isOpen = openShift === shift;
              const shiftLabel = shift === "shift_a" ? "Shift A" : shift === "shift_b" ? "Shift B" : "Shift C";
              return (
                <Card key={shift}>
                  <CardHeader>
                    <CardTitle>{shiftLabel}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {driver ? (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{driver.driver_name}</p>
                        <p className="text-sm text-slate-500">{driver.mobile ?? "Mobile not set"}</p>
                        <p className="text-sm text-slate-500">{driver.license_no ?? "License not set"}</p>
                        <p className="text-xs text-slate-400">Since {formatDate(driver.from_date)}</p>
                      </div>
                    ) : (
                      <p className="text-sm italic text-slate-400">No driver assigned</p>
                    )}

                    {canManage && (
                      <>
                        <Button
                          type="button"
                          variant={isOpen ? "outline" : "secondary"}
                          className="w-full"
                          onClick={() => setOpenShift(isOpen ? null : shift)}
                        >
                          {isOpen ? "Cancel" : driver ? "Change Driver" : "Assign Driver"}
                        </Button>

                        {isOpen && (
                          <form action={replaceDriverAction} className="space-y-3 border-t border-slate-100 pt-3">
                            <input type="hidden" name="vehicle_id" value={vehicle.vehicle_id} />
                            <input type="hidden" name="shift" value={shift} />
                            <div className="space-y-1.5">
                              <Label>Select Driver</Label>
                              <Select name="driver_id" required>
                                <option value="">Choose driver</option>
                                {activeAvailableDrivers.map((d) => (
                                  <option key={d.driver_id} value={d.driver_id}>
                                    {d.name}
                                    {d.mobile ? ` (${d.mobile})` : ""}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>From Date</Label>
                              <Input name="from_date" type="date" defaultValue={today} />
                            </div>
                            <Input name="remarks" placeholder="Remarks (optional)" />
                            <SubmitButton variant="secondary" className="w-full">
                              Confirm
                            </SubmitButton>
                          </form>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ─── FUEL LOGS ─── */}
        {tab === "Fuel Logs" && (
          <div className="space-y-5">

            {/* Vendor vehicle message */}
            {!isCompany && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
                <p className="text-sm font-semibold text-amber-800">Vendor-managed fuel</p>
                <p className="mt-1 text-sm text-amber-700">
                  This vehicle runs on vendor fuel. Fuel entries are not tracked here.
                  KM readings will appear automatically once GPS integration is live.
                </p>
              </div>
            )}

            {/* Summary strip — company vehicles only */}
            {isCompany && (
              <div className="grid grid-cols-3 gap-3">
                <FuelStat label="Entries this month" value={String(currentMonthSummary.entries)} />
                <FuelStat
                  label="Fuel this month"
                  value={currentMonthSummary.litres > 0 ? `${currentMonthSummary.litres} L` : "—"}
                />
                <FuelStat
                  label="Amount this month"
                  value={currentMonthSummary.amount > 0 ? `₹${currentMonthSummary.amount.toLocaleString("en-IN")}` : "—"}
                />
              </div>
            )}

            {/* Add Entry — company + canManage only. Big primary button reveals the simple form. */}
            {canAddFuelLog && (
              showFuelForm ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Add Fuel Entry</CardTitle>
                      <button
                        type="button"
                        onClick={() => setShowFuelForm(false)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <QuickFuelForm
                      vehicles={[fuelVehicleOption]}
                      action={addFuelLogAction}
                      today={today}
                      returnTo="vehicle"
                      locked
                    />
                  </CardContent>
                </Card>
              ) : (
                <DashedButton type="button" onClick={() => setShowFuelForm(true)}>
                  <Plus className="h-4 w-4" /> Add Fuel Entry
                </DashedButton>
              )
            )}

            {/* GPS device hint for company vehicles */}
            {isCompany && !hasGpsDevice && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
                Is vehicle ka <span className="font-medium">GPS Device ID</span> set nahi hai — distance auto-fetch
                nahi hoga. Vehicle edit karke Traccar device ID daalein.
              </div>
            )}

            {/* Fuel log history table */}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              {fuelLogsWithDerived.length === 0 ? (
                <CardContent className="py-8">
                  <EmptyState
                    message={
                      isCompany
                        ? "No fuel entries yet. Add the first entry above."
                        : "No fuel entries for this vehicle."
                    }
                  />
                </CardContent>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3">Litres</th>
                        <th className="px-5 py-3">Amount</th>
                        <th className="px-5 py-3">KM (GPS)</th>
                        <th className="px-5 py-3">Avg km/L</th>
                        <th className="px-5 py-3">Notes</th>
                        <th className="px-5 py-3">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {fuelLogsWithDerived.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3.5 font-medium text-slate-900">{formatDate(log.log_date)}</td>
                          <td className="px-5 py-3.5 text-slate-600">{log.fuel_type ?? "—"}</td>
                          <td className="px-5 py-3.5 text-slate-700">{log.fuel_litres} L</td>
                          <td className="px-5 py-3.5 text-slate-700">
                            {log.fuel_amount != null ? `₹${log.fuel_amount.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="px-5 py-3.5 text-slate-600">
                            {log.gps_distance_km != null ? (
                              `${log.gps_distance_km.toLocaleString("en-IN")} km`
                            ) : (
                              <span className="text-xs text-slate-400">
                                {anySynced ? "no GPS data" : "not synced"}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-slate-600">
                            {log.avg != null ? (
                              <Badge tone="blue">{log.avg} km/L</Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500">{log.notes ?? "—"}</td>
                          <td className="px-5 py-3.5 text-slate-500">{log.recorded_by ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ─── TRANSFERS ─── */}
        {tab === "Transfers" && (
          <Card>
            <CardContent className="pt-6">
              {transfers.length === 0 ? (
                <EmptyState message="No transfers recorded yet" />
              ) : (
                <Timeline
                  items={transfers.map((t) => ({
                    id: t.id,
                    date: t.transfer_date,
                    title: `${t.from_circle ?? "—"} / ${t.from_division ?? "Unassigned"} → ${t.to_circle ?? "—"} / ${t.to_division ?? "Unassigned"}`,
                    description: [
                      t.from_substation && t.to_substation ? `${t.from_substation} → ${t.to_substation}` : null,
                      t.approved_by ? `Approved by ${t.approved_by}` : null,
                      t.remarks ?? null,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                    badge: t.is_cross_circle ? "Cross-circle" : (t.reason ?? undefined),
                  }))}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── STATUS HISTORY ─── */}
        {tab === "Status History" && (
          <Card>
            <CardContent className="pt-6">
              {statusHistory.length === 0 ? (
                <EmptyState message="No status changes recorded yet" />
              ) : (
                <Timeline
                  items={statusHistory.map((item) => ({
                    id: item.id,
                    date: item.from_date,
                    title: titleCase(item.status),
                    description: [
                      item.remarks ?? "No remarks",
                      item.to_date ? `Until ${formatDate(item.to_date)}` : "Current",
                    ].join(" · "),
                    badge: item.recorded_by ?? undefined,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── FUEL HISTORY (ownership changes) ─── */}
        {tab === "Fuel History" && (
          <Card>
            <CardContent className="pt-6">
              {fuelOwnershipHistory.length === 0 ? (
                <EmptyState message="No fuel ownership changes recorded yet" />
              ) : (
                <Timeline
                  items={fuelOwnershipHistory.map((item) => ({
                    id: item.id,
                    date: item.from_date,
                    title: item.ownership === "vendor" ? "Vendor Fuel" : "Company Fuel",
                    description: [
                      item.remarks ?? "No remarks",
                      item.to_date ? `Until ${formatDate(item.to_date)}` : "Current",
                    ].join(" · "),
                    badge: item.changed_by ?? undefined,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── DRIVER SOURCE (ownership changes) ─── */}
        {tab === "Driver Source" && (
          <Card>
            <CardContent className="pt-6">
              {driverOwnershipHistory.length === 0 ? (
                <EmptyState message="No driver source changes recorded yet" />
              ) : (
                <Timeline
                  items={driverOwnershipHistory.map((item) => ({
                    id: item.id,
                    date: item.from_date,
                    title: item.ownership === "vendor" ? "Vendor Driver" : "Company Driver",
                    description: [
                      item.remarks ?? "No remarks",
                      item.to_date ? `Until ${formatDate(item.to_date)}` : "Current",
                    ].join(" · "),
                    badge: item.changed_by ?? undefined,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── DRIVER HISTORY ─── */}
        {tab === "Driver History" && (
          <Card className="overflow-hidden">
            {drivers.length === 0 ? (
              <CardContent className="py-8">
                <EmptyState message="No driver history available" />
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Driver</th>
                      <th className="px-5 py-3">Shift</th>
                      <th className="px-5 py-3">From</th>
                      <th className="px-5 py-3">To</th>
                      <th className="px-5 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {drivers.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-medium text-slate-900">{d.driver_name}</td>
                        <td className="px-5 py-3.5 text-slate-600">{titleCase(d.shift)}</td>
                        <td className="px-5 py-3.5 text-slate-600">{formatDate(d.from_date)}</td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {d.to_date ? (
                            formatDate(d.to_date)
                          ) : (
                            <span className="font-medium text-emerald-600">Current</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">{d.remarks ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ─── DOCUMENTS ─── */}
        {tab === "Documents" && (
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                { label: "Insurance", date: vehicle.insurance_expiry },
                { label: "Fitness Certificate", date: vehicle.fitness_expiry },
                { label: "Pollution Control", date: vehicle.pollution_expiry },
              ] as const
            ).map((doc) => (
              <Card key={doc.label}>
                <CardHeader>
                  <CardTitle className="text-sm">{doc.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ExpiryBadge label={doc.label} date={doc.date} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{children}</dd>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-8 text-center text-sm text-slate-400">{message}</p>
  );
}

function FuelStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
      <p className="text-lg font-bold text-slate-900 sm:text-xl">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}
