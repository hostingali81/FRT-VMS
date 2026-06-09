"use client";

import { ChevronDown, ChevronUp, Download, Edit3, Filter, RefreshCcw, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { ExpiryBadge } from "@/components/shared/ExpiryBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { FleetVehicle, LookupData } from "@/lib/types";
import { exportRows } from "@/lib/utils/export";
import { getWorstDocumentState } from "@/lib/utils/expiry";

export function VehicleTable({
  vehicles,
  lookups,
  canUpdate = false,
  canExport = false,
  editableVehicleIds,
  transferableVehicleIds,
}: {
  vehicles: FleetVehicle[];
  lookups: LookupData;
  canUpdate?: boolean;
  canExport?: boolean;
  editableVehicleIds?: string[];
  transferableVehicleIds?: string[];
}) {
  const [search, setSearch] = useState("");
  const [circleId, setCircleId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [substationId, setSubstationId] = useState("");
  const [status, setStatus] = useState("");
  const [vendor, setVendor] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = [circleId, divisionId, substationId, status, vendor].filter(Boolean).length;

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
  const editableIds = useMemo(() => new Set(editableVehicleIds ?? []), [editableVehicleIds]);
  const transferableIds = useMemo(() => new Set(transferableVehicleIds ?? []), [transferableVehicleIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const frtSortKey = (vehicle: FleetVehicle) => {
      const match = vehicle.frt_no?.match(/\d+/);
      return match ? parseInt(match[0], 10) : Number.POSITIVE_INFINITY;
    };
    return vehicles
      .filter((vehicle) => {
      const matchesSearch =
        !q ||
        vehicle.registration_no?.toLowerCase().includes(q) ||
        vehicle.frt_no?.toLowerCase().includes(q) ||
        vehicle.vehicle_type?.toLowerCase().includes(q) ||
        vehicle.owner_name?.toLowerCase().includes(q) ||
        vehicle.vendor_name?.toLowerCase().includes(q) ||
        vehicle.current_circle?.toLowerCase().includes(q) ||
        vehicle.division?.toLowerCase().includes(q) ||
        vehicle.substation?.toLowerCase().includes(q);
      return (
        matchesSearch &&
        (!circleId || vehicle.current_circle_id === circleId || vehicle.home_circle_id === circleId) &&
        (!divisionId || vehicle.division_id === divisionId) &&
        (!substationId || vehicle.substation_id === substationId) &&
        (!status || vehicle.status === status) &&
        (!vendor || vehicle.vendor_name === vendor)
      );
    })
      .sort((a, b) => frtSortKey(a) - frtSortKey(b));
  }, [search, circleId, divisionId, status, substationId, vehicles, vendor]);

  const filterSelects = (
    <>
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
    </>
  );

  return (
    <Card className="overflow-hidden">
      {/* ── Desktop filter bar (md+) ── */}
      <div className="hidden border-b border-slate-200 bg-white p-4 md:block">
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Search by FRT no, reg no, type, circle, vendor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="p-1 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-3">
          {filterSelects}
        </div>
      </div>

      {/* ── Mobile filter bar (< md) ── */}
      <div className="border-b border-slate-200 bg-white p-3 md:hidden">
        {/* Search always visible */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search vehicles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {/* Filters toggle */}
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </span>
          {filtersOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        {/* Collapsible filter dropdowns */}
        {filtersOpen && (
          <div className="mt-2 flex flex-col gap-2">
            {filterSelects}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">{filtered.length} vehicles visible</p>
        {canExport && (
          <Button
            variant="outline"
            className="h-9 px-3 text-xs"
            onClick={() =>
              exportRows(
                "frt-vehicles",
                filtered.map((vehicle) => ({
                  "FRT No": vehicle.frt_no,
                  Registration: vehicle.registration_no,
                  Type: vehicle.vehicle_type,
                  Owner: vehicle.owner_name,
                  "Owner Mobile": vehicle.owner_mobile,
                  Vendor: vehicle.vendor_name,
                  Circle: vehicle.current_circle,
                  Division: vehicle.division,
                  Substation: vehicle.substation,
                  Status: vehicle.status,
                  "Fuel By": vehicle.fuel_ownership === "vendor" ? "Vendor" : "Company",
                  "Driver By": vehicle.driver_ownership === "vendor" ? "Vendor" : "Company",
                })),
              )
            }
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full divide-y divide-slate-200 text-xs sm:min-w-[1200px] sm:text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3 min-w-[150px] sm:min-w-[220px]">FRT No / Location</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Reg No / Vendor</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Type</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Owner</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Circle</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Status</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Fuel / Driver</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">GPS</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Doc Status</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3 text-right">Actions</th>
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
                  <td data-label="FRT No / Location" className="px-3 py-3 sm:px-5 sm:py-4">
                    <span className="block whitespace-nowrap font-semibold text-slate-700">{vehicle.frt_no ?? "—"}</span>
                    <span className="mt-1 block text-xs font-semibold text-slate-700">{vehicle.division ?? "Unassigned"}</span>
                    {vehicle.substation && (
                      <span className="block text-xs font-medium text-slate-600">{vehicle.substation}</span>
                    )}
                  </td>
                  <td data-label="Reg No / Vendor" className="px-3 py-3 sm:px-5 sm:py-4">
                    <Link
                      href={`/vehicles/${vehicle.vehicle_id}`}
                      className="block whitespace-nowrap font-semibold text-slate-950 hover:underline"
                    >
                      {vehicle.registration_no}
                    </Link>
                    <span className="block text-xs text-slate-400">{vehicle.vendor_name ?? "—"}</span>
                  </td>
                  <td data-label="Type" className="px-3 py-3 sm:px-5 sm:py-4 text-slate-600">{vehicle.vehicle_type ?? "Not set"}</td>
                  <td data-label="Owner" className="px-3 py-3 sm:px-5 sm:py-4 text-slate-600">
                    {vehicle.owner_name ?? "—"}
                    {vehicle.owner_mobile && (
                      <span className="block text-xs text-slate-400">{vehicle.owner_mobile}</span>
                    )}
                  </td>
                  <td data-label="Circle" className="px-3 py-3 sm:px-5 sm:py-4 text-slate-600">{vehicle.current_circle ?? vehicle.home_circle}</td>
                  <td data-label="Status" className="px-3 py-3 sm:px-5 sm:py-4">
                    <StatusBadge status={vehicle.status} />
                  </td>
                  <td data-label="Fuel / Driver" className="px-3 py-3 sm:px-5 sm:py-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="inline-block w-12">Fuel</span>
                        <Badge tone={vehicle.fuel_ownership === "vendor" ? "yellow" : "blue"}>
                          {vehicle.fuel_ownership === "vendor" ? "Vendor" : "Company"}
                        </Badge>
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="inline-block w-12">Driver</span>
                        <Badge tone={vehicle.driver_ownership === "vendor" ? "yellow" : "blue"}>
                          {vehicle.driver_ownership === "vendor" ? "Vendor" : "Company"}
                        </Badge>
                      </span>
                    </div>
                  </td>
                  <td data-label="GPS" className="px-3 py-3 sm:px-5 sm:py-4 text-slate-600">{vehicle.gps_company ?? "Not set"}</td>
                  <td data-label="Document Status" className="px-3 py-3 sm:px-5 sm:py-4">
                    <ExpiryBadge date={date} />
                  </td>
                  <td data-label="Action" className="px-3 py-3 sm:px-5 sm:py-4">
                    <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end sm:gap-2">
                      {canUpdate || editableIds.has(vehicle.vehicle_id) ? (
                        <LinkButton
                          href={`/vehicles/${vehicle.vehicle_id}/edit`}
                          variant="outline"
                          className="h-9 px-3 text-xs"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </LinkButton>
                      ) : null}
                      {transferableIds.has(vehicle.vehicle_id) ? (
                        <LinkButton
                          href={`/vehicles/${vehicle.vehicle_id}/transfer`}
                          variant="primary"
                          className="h-9 px-3 text-xs"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          Transfer
                        </LinkButton>
                      ) : null}
                    </div>
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
