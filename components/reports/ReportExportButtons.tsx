"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import type { CircleSummary, FleetVehicle, TransferRecord } from "@/lib/types";

type ReportKey =
  | "circle-deployment"
  | "vehicle-movement"
  | "cross-circle"
  | "driver-duty"
  | "document-compliance"
  | "vendor-fleet"
  | "division-active";

const REPORT_LABELS: Record<ReportKey, string> = {
  "circle-deployment": "Circle-wise Deployment Summary",
  "vehicle-movement": "Vehicle Movement Report",
  "cross-circle": "Cross-Circle Transfer Report",
  "driver-duty": "Driver Duty Report",
  "document-compliance": "Document Compliance Report",
  "vendor-fleet": "Vendor Fleet Report",
  "division-active": "Division-wise Active Fleet",
};

function download(sheetData: Record<string, unknown>[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

function getDocState(expiry: string | null): "expired" | "expiring" | "valid" | "unknown" {
  if (!expiry) return "unknown";
  const today = new Date();
  const exp = new Date(expiry);
  const diff = (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "expired";
  if (diff <= 30) return "expiring";
  return "valid";
}

function worstState(dates: Array<string | null>): string {
  const states = dates.map(getDocState);
  if (states.includes("expired")) return "Expired";
  if (states.includes("expiring")) return "Expiring Soon";
  if (states.includes("valid")) return "Valid";
  return "Not Recorded";
}

function generateReport(
  key: ReportKey,
  circles: CircleSummary[],
  transfers: TransferRecord[],
  vehicles: FleetVehicle[],
) {
  switch (key) {
    case "circle-deployment":
      download(
        circles.map((c) => ({
          Circle: c.circle,
          Total: c.total,
          Active: c.active,
          Maintenance: c.maintenance,
          Breakdown: c.breakdown,
          Standby: c.standby,
          "Docs Expiring": c.documents_expiring,
        })),
        "circle-deployment-summary",
      );
      break;

    case "vehicle-movement":
      download(
        transfers.map((t) => ({
          "Registration No": t.registration_no,
          "Transfer Date": t.transfer_date,
          "From Circle": t.from_circle ?? "",
          "From Division": t.from_division ?? "",
          "From Substation": t.from_substation ?? "",
          "To Circle": t.to_circle ?? "",
          "To Division": t.to_division ?? "",
          "To Substation": t.to_substation ?? "",
          "Cross-Circle": t.is_cross_circle ? "Yes" : "No",
          Reason: t.reason ?? "",
          "Approved By": t.approved_by ?? "",
          Remarks: t.remarks ?? "",
        })),
        "vehicle-movement-report",
      );
      break;

    case "cross-circle":
      download(
        transfers
          .filter((t) => t.is_cross_circle)
          .map((t) => ({
            "Registration No": t.registration_no,
            "Transfer Date": t.transfer_date,
            "From Circle": t.from_circle ?? "",
            "To Circle": t.to_circle ?? "",
            Reason: t.reason ?? "",
            "Approved By": t.approved_by ?? "",
          })),
        "cross-circle-transfer-report",
      );
      break;

    case "driver-duty":
      toast.info("Driver Duty Report coming soon");
      return;

    case "document-compliance":
      download(
        vehicles
          .filter((v) => v.status !== "removed")
          .map((v) => ({
            "Registration No": v.registration_no,
            Circle: v.home_circle,
            Division: v.division ?? "",
            "Insurance Expiry": v.insurance_expiry ?? "Not Recorded",
            "Fitness Expiry": v.fitness_expiry ?? "Not Recorded",
            "Pollution Expiry": v.pollution_expiry ?? "Not Recorded",
            "Overall Status": worstState([v.insurance_expiry, v.fitness_expiry, v.pollution_expiry]),
          })),
        "document-compliance-report",
      );
      break;

    case "vendor-fleet":
      download(
        vehicles
          .filter((v) => v.status !== "removed")
          .map((v) => ({
            "Registration No": v.registration_no,
            Vendor: v.vendor_name ?? "Unknown",
            Circle: v.home_circle,
            Division: v.division ?? "",
            Status: v.status,
            "Vehicle Type": v.vehicle_type ?? "",
            "Fuel Type": v.fuel_type ?? "",
          }))
          .sort((a, b) => a.Vendor.localeCompare(b.Vendor)),
        "vendor-fleet-report",
      );
      break;

    case "division-active":
      download(
        vehicles
          .filter((v) => v.status === "active")
          .map((v) => ({
            "Registration No": v.registration_no,
            Circle: v.current_circle ?? v.home_circle,
            Division: v.division ?? "",
            Substation: v.substation ?? "",
            "Vehicle Type": v.vehicle_type ?? "",
            "Fuel Type": v.fuel_type ?? "",
            "GPS Company": v.gps_company ?? "",
          }))
          .sort((a, b) => a.Circle.localeCompare(b.Circle) || a.Division.localeCompare(b.Division)),
        "division-active-fleet",
      );
      break;
  }
}

export function ReportExportButtons({
  circles,
  transfers,
  vehicles,
}: {
  circles: CircleSummary[];
  transfers: TransferRecord[];
  vehicles: FleetVehicle[];
}) {
  const [loading, setLoading] = useState<ReportKey | null>(null);

  async function handleClick(key: ReportKey) {
    setLoading(key);
    try {
      generateReport(key, circles, transfers, vehicles);
      if (key !== "driver-duty") toast.success(`${REPORT_LABELS[key]} downloaded`);
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      {(Object.keys(REPORT_LABELS) as ReportKey[]).map((key) => (
        <button
          key={key}
          onClick={() => handleClick(key)}
          disabled={loading === key}
          className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {REPORT_LABELS[key]}
          {loading === key ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      ))}
    </div>
  );
}
