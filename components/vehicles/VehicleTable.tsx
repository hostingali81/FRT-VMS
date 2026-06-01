"use client";

import { Download, Edit3, Eye, Filter, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { ExpiryBadge } from "@/components/shared/ExpiryBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { FleetVehicle, LookupData } from "@/lib/types";
import { exportRows } from "@/lib/utils/export";
import { getWorstDocumentState } from "@/lib/utils/expiry";

export function VehicleTable({
  vehicles,
  lookups,
  canCreate = false,
  canUpdate = false,
}: {
  vehicles: FleetVehicle[];
  lookups: LookupData;
  canCreate?: boolean;
  canUpdate?: boolean;
}) {
  const [circleId, setCircleId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [substationId, setSubstationId] = useState("");
  const [status, setStatus] = useState("");
  const [vendor, setVendor] = useState("");

  const divisions = useMemo(
    () => lookups.divisions.filter((division) => !circleId || division.circle_id === circleId),
    [circleId, lookups.divisions],
  );

  const substations = useMemo(
    () => lookups.substations.filter((substation) => !divisionId || substation.division_id === divisionId),
    [divisionId, lookups.substations],
  );

  const vendors = useMemo(
    () => Array.from(new Set(vehicles.map((vehicle) => vehicle.vendor_name).filter(Boolean))).sort() as string[],
    [vehicles],
  );

  const filtered = useMemo(
    () =>
      vehicles.filter((vehicle) => {
        return (
          (!circleId || vehicle.current_circle_id === circleId || vehicle.home_circle_id === circleId) &&
          (!divisionId || vehicle.division_id === divisionId) &&
          (!substationId || vehicle.substation_id === substationId) &&
          (!status || vehicle.status === status) &&
          (!vendor || vehicle.vendor_name === vendor)
        );
      }),
    [circleId, divisionId, status, substationId, vehicles, vendor],
  );

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-3 border-b border-slate-200 bg-white p-4 md:grid-cols-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-5">
          <Filter className="h-4 w-4" aria-hidden="true" />
          Filters
        </div>
        <Select
          value={circleId}
          onChange={(event) => {
            setCircleId(event.target.value);
            setDivisionId("");
            setSubstationId("");
          }}
          aria-label="Circle"
        >
          <option value="">All circles</option>
          {lookups.circles.map((circle) => (
            <option key={circle.id} value={circle.id}>
              {circle.name}
            </option>
          ))}
        </Select>
        <Select
          value={divisionId}
          onChange={(event) => {
            setDivisionId(event.target.value);
            setSubstationId("");
          }}
          aria-label="Division"
        >
          <option value="">All divisions</option>
          {divisions.map((division) => (
            <option key={division.id} value={division.id}>
              {division.name}
            </option>
          ))}
        </Select>
        <Select value={substationId} onChange={(event) => setSubstationId(event.target.value)} aria-label="Substation">
          <option value="">All substations</option>
          {substations.map((substation) => (
            <option key={substation.id} value={substation.id}>
              {substation.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="breakdown">Breakdown</option>
          <option value="standby">Standby</option>
          <option value="removed">Removed</option>
          <option value="accident">Accident</option>
        </Select>
        <Select value={vendor} onChange={(event) => setVendor(event.target.value)} aria-label="Vendor">
          <option value="">All vendors</option>
          {vendors.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-600">{filtered.length} vehicles visible</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            onClick={() =>
              exportRows(
                "frt-vehicles",
                filtered.map((vehicle) => ({
                  Registration: vehicle.registration_no,
                  Type: vehicle.vehicle_type,
                  Circle: vehicle.current_circle,
                  Division: vehicle.division,
                  Substation: vehicle.substation,
                  Status: vehicle.status,
                  Vendor: vehicle.vendor_name,
                })),
              )
            }
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>
          {canCreate ? (
            <LinkButton href="/vehicles/new" variant="primary" className="h-9">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Vehicle
            </LinkButton>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Reg No</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Circle</th>
              <th className="px-5 py-3">Division</th>
              <th className="px-5 py-3">Substation</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">GPS</th>
              <th className="px-5 py-3">Doc Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.map((vehicle) => {
              const worst = getWorstDocumentState([vehicle.insurance_expiry, vehicle.fitness_expiry, vehicle.pollution_expiry]);
              const date =
                worst === "expired" || worst === "expiring"
                  ? [vehicle.insurance_expiry, vehicle.fitness_expiry, vehicle.pollution_expiry]
                      .filter(Boolean)
                      .sort()[0]
                  : vehicle.insurance_expiry;

              return (
                <tr key={vehicle.vehicle_id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">
                    <Link href={`/vehicles/${vehicle.vehicle_id}`} className="hover:underline">
                      {vehicle.registration_no}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{vehicle.vehicle_type ?? "Not set"}</td>
                  <td className="px-5 py-4 text-slate-600">{vehicle.current_circle ?? vehicle.home_circle}</td>
                  <td className="px-5 py-4 text-slate-600">{vehicle.division ?? "Unassigned"}</td>
                  <td className="px-5 py-4 text-slate-600">{vehicle.substation ?? "Unassigned"}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={vehicle.status} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">{vehicle.gps_device_id ?? "Not set"}</td>
                  <td className="px-5 py-4">
                    <ExpiryBadge date={date} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    {canUpdate ? (
                      <Link
                        href={`/vehicles/${vehicle.vehicle_id}/edit`}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        title="Update vehicle"
                      >
                        <Edit3 className="h-4 w-4" aria-hidden="true" />
                        Update
                      </Link>
                    ) : (
                      <Link
                        href={`/vehicles/${vehicle.vehicle_id}`}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        title="View vehicle"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
