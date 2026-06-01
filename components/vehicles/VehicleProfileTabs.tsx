"use client";

import { Edit3, FileText, Fuel, MapPin, Phone, RefreshCcw, UserRound, Wrench } from "lucide-react";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { ExpiryBadge } from "@/components/shared/ExpiryBadge";
import { Timeline } from "@/components/shared/Timeline";
import type { DriverAssignment, DriverRecord, FleetVehicle, StatusHistoryItem, TransferRecord } from "@/lib/types";
import { formatDate, titleCase } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const tabs = ["Overview", "Current Drivers", "Transfer History", "Status History", "Driver History", "Documents"];

export function VehicleProfileTabs({
  vehicle,
  drivers,
  transfers,
  statusHistory,
  availableDrivers,
  canManage,
  canTransfer,
  changeStatusAction,
  replaceDriverAction,
}: {
  vehicle: FleetVehicle;
  drivers: DriverAssignment[];
  transfers: TransferRecord[];
  statusHistory: StatusHistoryItem[];
  availableDrivers: DriverRecord[];
  canManage: boolean;
  canTransfer: boolean;
  changeStatusAction: (formData: FormData) => Promise<void>;
  replaceDriverAction: (formData: FormData) => Promise<void>;
}) {
  const [tab, setTab] = useState(tabs[0]);
  const currentDrivers = drivers.filter((driver) => !driver.to_date);
  const activeAvailableDrivers = availableDrivers.filter((driver) => driver.status === "active");

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border-b border-slate-200 bg-white">
        <div className="flex min-w-max gap-1 px-4 sm:px-6 lg:px-8">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={cn(
                "border-b-2 px-3 py-3 text-sm font-semibold",
                item === tab ? "border-slate-950 text-slate-950" : "border-transparent text-slate-500 hover:text-slate-900",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8">
        {tab === "Overview" ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Master Details</CardTitle>
                  {canManage ? (
                    <LinkButton href={`/vehicles/${vehicle.vehicle_id}/edit`} variant="outline" className="h-9">
                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </LinkButton>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Info icon={<Fuel />} label="Type / Fuel" value={`${vehicle.vehicle_type ?? "Vehicle"} / ${vehicle.fuel_type ?? "Fuel not set"}`} />
                <Info icon={<UserRound />} label="Owner" value={vehicle.owner_name ?? "Not set"} detail={vehicle.owner_mobile ?? undefined} />
                <Info icon={<FileText />} label="Vendor" value={vehicle.vendor_name ?? "Not set"} />
                <Info icon={<MapPin />} label="Current Location" value={`${vehicle.current_circle ?? vehicle.home_circle} / ${vehicle.division ?? "Unassigned"} / ${vehicle.substation ?? "Unassigned"}`} />
                <Info icon={<Phone />} label="GPS" value={vehicle.gps_company ?? "Not set"} detail={vehicle.gps_device_id ?? undefined} />
                <Info icon={<Wrench />} label="Status" value={titleCase(vehicle.status)} />
              </CardContent>
            </Card>
            <div className="space-y-4">
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
              {canManage ? <StatusForm vehicleId={vehicle.vehicle_id} action={changeStatusAction} /> : null}
            </div>
          </div>
        ) : null}

        {tab === "Current Drivers" ? (
          <div className="grid gap-4 md:grid-cols-3">
            {(["morning", "evening", "night"] as const).map((shift) => {
              const driver = currentDrivers.find((item) => item.shift === shift);
              return (
                <Card key={shift}>
                  <CardHeader>
                    <CardTitle>{titleCase(shift)} Shift</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {driver ? (
                      <>
                        <p className="text-lg font-semibold text-slate-950">{driver.driver_name}</p>
                        <p className="text-slate-600">{driver.mobile ?? "Mobile not set"}</p>
                        <p className="text-slate-600">{driver.license_no ?? "License not set"}</p>
                        <p className="text-slate-500">Since {formatDate(driver.from_date)}</p>
                      </>
                    ) : (
                      <p className="text-slate-500">No active driver assigned.</p>
                    )}
                    {canManage ? (
                      <DriverReplaceForm
                        vehicleId={vehicle.vehicle_id}
                        shift={shift}
                        drivers={activeAvailableDrivers}
                        action={replaceDriverAction}
                      />
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}

        {tab === "Transfer History" ? (
          <Card>
            <CardContent>
              <Timeline
                items={transfers.map((transfer) => ({
                  id: transfer.id,
                  date: transfer.transfer_date,
                  title: `${transfer.from_substation ?? "Unassigned"} to ${transfer.to_substation ?? "Unassigned"}`,
                  description: `${transfer.from_circle ?? "No circle"} / ${transfer.from_division ?? "No division"} to ${transfer.to_circle ?? "No circle"} / ${transfer.to_division ?? "No division"} by ${transfer.approved_by ?? "Not recorded"}`,
                  badge: transfer.is_cross_circle ? "Cross-circle" : transfer.reason ?? undefined,
                }))}
              />
            </CardContent>
          </Card>
        ) : null}

        {tab === "Status History" ? (
          <Card>
            <CardContent>
              <Timeline
                items={statusHistory.map((item) => ({
                  id: item.id,
                  date: item.from_date,
                  title: titleCase(item.status),
                  description: `${item.remarks ?? "No remarks"}${item.to_date ? ` until ${formatDate(item.to_date)}` : ""}`,
                  badge: item.recorded_by ?? undefined,
                }))}
              />
            </CardContent>
          </Card>
        ) : null}

        {tab === "Driver History" ? (
          <Card className="overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Driver</th>
                  <th className="px-5 py-3">Shift</th>
                  <th className="px-5 py-3">From</th>
                  <th className="px-5 py-3">To</th>
                  <th className="px-5 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {drivers.map((driver) => (
                  <tr key={driver.id}>
                    <td className="px-5 py-4 font-medium text-slate-950">{driver.driver_name}</td>
                    <td className="px-5 py-4">{titleCase(driver.shift)}</td>
                    <td className="px-5 py-4">{formatDate(driver.from_date)}</td>
                    <td className="px-5 py-4">{driver.to_date ? formatDate(driver.to_date) : "Current"}</td>
                    <td className="px-5 py-4 text-slate-600">{driver.remarks ?? "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : null}

        {tab === "Documents" ? (
          <Card>
            <CardHeader>
              <CardTitle>Document Compliance</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <ExpiryBadge label="Insurance" date={vehicle.insurance_expiry} />
              <ExpiryBadge label="Fitness" date={vehicle.fitness_expiry} />
              <ExpiryBadge label="Pollution" date={vehicle.pollution_expiry} />
            </CardContent>
          </Card>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {canTransfer ? (
            <LinkButton href={`/vehicles/${vehicle.vehicle_id}/transfer`} variant="primary">
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Transfer Vehicle
            </LinkButton>
          ) : null}
          <LinkButton href="/vehicles" variant="outline">
            Back to Vehicles
          </LinkButton>
        </div>
      </div>
    </div>
  );
}

function StatusForm({ vehicleId, action }: { vehicleId: string; action: (formData: FormData) => Promise<void> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Status</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <input type="hidden" name="vehicle_id" value={vehicleId} />
          <div className="space-y-2">
            <Label>Status</Label>
            <Select name="status" required>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="breakdown">Breakdown</option>
              <option value="standby">Standby</option>
              <option value="removed">Removed</option>
              <option value="accident">Accident</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>From Date</Label>
            <Input name="from_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea name="remarks" />
          </div>
          <Button type="submit" className="w-full">Update Status</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DriverReplaceForm({
  vehicleId,
  shift,
  drivers,
  action,
}: {
  vehicleId: string;
  shift: string;
  drivers: DriverRecord[];
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="space-y-2 border-t border-slate-200 pt-3">
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <input type="hidden" name="shift" value={shift} />
      <Select name="driver_id" required>
        <option value="">Change driver</option>
        {drivers.map((driver) => (
          <option key={driver.driver_id} value={driver.driver_id}>
            {driver.name} {driver.mobile ? `(${driver.mobile})` : ""}
          </option>
        ))}
      </Select>
      <Input name="from_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      <Input name="remarks" placeholder="Remarks" />
      <Button type="submit" variant="secondary" className="w-full">Assign</Button>
    </form>
  );
}

function Info({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex gap-3 rounded-md border border-slate-200 p-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
        {detail ? <p className="mt-0.5 text-sm text-slate-500">{detail}</p> : null}
      </div>
    </div>
  );
}
