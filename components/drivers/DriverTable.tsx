"use client";

import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ExpiryBadge } from "@/components/shared/ExpiryBadge";
import type { DriverRecord } from "@/lib/types";
import { exportRows } from "@/lib/utils/export";
import { formatDate, titleCase } from "@/lib/utils/format";

export function DriverTable({ drivers }: { drivers: DriverRecord[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <p className="text-sm text-slate-600">{drivers.length} drivers</p>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          onClick={() =>
            exportRows(
              "frt-drivers",
              drivers.map((driver) => ({
                Name: driver.name,
                Mobile: driver.mobile,
                License: driver.license_no,
                Expiry: driver.license_expiry,
                Circle: driver.circle,
                Vehicle: driver.registration_no,
                Shift: driver.shift,
                Status: driver.status,
              })),
            )
          }
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Mobile</th>
              <th className="px-5 py-3">License</th>
              <th className="px-5 py-3">Expiry</th>
              <th className="px-5 py-3">Circle</th>
              <th className="px-5 py-3">Assigned Vehicle</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {drivers.map((driver) => (
              <tr key={`${driver.driver_id}-${driver.shift ?? "unassigned"}`}>
                <td data-label="Name" className="px-5 py-4 font-semibold text-slate-950">{driver.name}</td>
                <td data-label="Mobile" className="px-5 py-4 text-slate-600">{driver.mobile ?? "Not set"}</td>
                <td data-label="License" className="px-5 py-4 text-slate-600">{driver.license_no ?? "Not set"}</td>
                <td data-label="Expiry" className="px-5 py-4">
                  <ExpiryBadge date={driver.license_expiry} />
                </td>
                <td data-label="Circle" className="px-5 py-4 text-slate-600">{driver.circle}</td>
                <td data-label="Assigned Vehicle" className="px-5 py-4 text-slate-600">
                  {driver.registration_no ? `${driver.registration_no} (${titleCase(driver.shift)}) since ${formatDate(driver.assigned_from)}` : "Unassigned"}
                </td>
                <td data-label="Status" className="px-5 py-4">
                  <Badge tone={driver.status === "active" ? "green" : "gray"}>{titleCase(driver.status)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
