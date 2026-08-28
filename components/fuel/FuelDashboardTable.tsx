"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Download, Droplets, Filter, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Tooltip } from "@/components/ui/tooltip";
import type { FuelMileage } from "@/lib/mileage";
import { cn } from "@/lib/utils/cn";
import { exportRows } from "@/lib/utils/export";
import { formatDate } from "@/lib/utils/format";

/** One vehicle's month row — precomputed on the server, plain data so it serializes. */
export type FuelDashboardRow = {
  vehicleId: string;
  registrationNo: string;
  frtNo: string | null;
  vendorName: string | null;
  circleId: string | null;
  circle: string | null;
  divisionId: string | null;
  division: string | null;
  substationId: string | null;
  substation: string | null;
  isCompany: boolean;
  entries: number;
  totalLitres: number;
  totalAmount: number;
  gpsKm: number;
  hasGps: boolean;
  canManage: boolean;
  monthlyMileage: FuelMileage[];
  allTimeMileage: FuelMileage[];
  /** Dominant fuel type's mileage window — used for the roll-up average. */
  primaryMonthly: { distanceKm: number; litres: number } | null;
};

type GroupBy = "none" | "division" | "circle" | "substation";

const GROUP_LABEL: Record<Exclude<GroupBy, "none">, string> = {
  division: "Division",
  circle: "Circle",
  substation: "Substation",
};

const UNASSIGNED = "Unassigned";

type Totals = {
  vehicles: number;
  entries: number;
  totalKm: number;
  companyKm: number;
  litres: number;
  amount: number;
  avg: number | null;
};

/**
 * Roll up a set of vehicle rows. Litres/cost/entries count only company-fuelled
 * vehicles (the company does not pay for vendor fuel), while "total distance"
 * covers every vehicle in the set — the same rules the fleet strip has always used.
 */
function rollup(rows: FuelDashboardRow[]): Totals {
  const company = rows.filter((r) => r.isCompany);
  // Round the float sums — adding decimals leaves artifacts like 14.190000000000001.
  const litres = +company.reduce((sum, r) => sum + r.totalLitres, 0).toFixed(2);
  const mileageKm = company.reduce((sum, r) => sum + (r.primaryMonthly?.distanceKm ?? 0), 0);
  const mileageL = company.reduce((sum, r) => sum + (r.primaryMonthly?.litres ?? 0), 0);
  return {
    vehicles: rows.length,
    entries: company.reduce((sum, r) => sum + r.entries, 0),
    totalKm: rows.reduce((sum, r) => sum + r.gpsKm, 0),
    companyKm: company.reduce((sum, r) => sum + r.gpsKm, 0),
    litres,
    amount: company.reduce((sum, r) => sum + r.totalAmount, 0),
    avg: mileageL > 0 ? +(mileageKm / mileageL).toFixed(1) : null,
  };
}

const km = (n: number) => (n > 0 ? `${Math.round(n).toLocaleString("en-IN")} km` : "—");
const inr = (n: number) => (n > 0 ? `₹${n.toLocaleString("en-IN")}` : "—");

export function FuelDashboardTable({
  rows,
  yearMonth,
  syncSlot,
}: {
  rows: FuelDashboardRow[];
  yearMonth: string;
  syncSlot?: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [circleId, setCircleId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [substationId, setSubstationId] = useState("");
  const [ownership, setOwnership] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const activeFilterCount = [circleId, divisionId, substationId, ownership].filter(Boolean).length;

  // Options come from the rows themselves, so a dropdown never offers a location
  // that has no vehicle on this dashboard.
  const circles = useMemo(() => uniqueOptions(rows, (r) => [r.circleId, r.circle]), [rows]);
  const divisions = useMemo(
    () => uniqueOptions(rows.filter((r) => !circleId || r.circleId === circleId), (r) => [r.divisionId, r.division]),
    [rows, circleId],
  );
  const substations = useMemo(
    () =>
      uniqueOptions(
        rows.filter((r) => (!circleId || r.circleId === circleId) && (!divisionId || r.divisionId === divisionId)),
        (r) => [r.substationId, r.substation],
      ),
    [rows, circleId, divisionId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch =
        !q ||
        r.registrationNo?.toLowerCase().includes(q) ||
        r.frtNo?.toLowerCase().includes(q) ||
        r.vendorName?.toLowerCase().includes(q) ||
        r.circle?.toLowerCase().includes(q) ||
        r.division?.toLowerCase().includes(q) ||
        r.substation?.toLowerCase().includes(q);
      return (
        matchesSearch &&
        (!circleId || r.circleId === circleId) &&
        (!divisionId || r.divisionId === divisionId) &&
        (!substationId || r.substationId === substationId) &&
        (!ownership || (ownership === "company" ? r.isCompany : !r.isCompany))
      );
    });
  }, [rows, search, circleId, divisionId, substationId, ownership]);

  const totals = useMemo(() => rollup(filtered), [filtered]);

  // Grouped view: one bucket per division/circle/substation, "Unassigned" last.
  const groups = useMemo(() => {
    if (groupBy === "none") return [];
    const pick = (r: FuelDashboardRow) =>
      groupBy === "division" ? r.division : groupBy === "circle" ? r.circle : r.substation;
    const buckets = new Map<string, FuelDashboardRow[]>();
    for (const row of filtered) {
      const key = pick(row) ?? UNASSIGNED;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(row);
      else buckets.set(key, [row]);
    }
    return Array.from(buckets, ([name, groupRows]) => ({
      name,
      rows: groupRows,
      totals: rollup(groupRows),
    })).sort((a, b) => {
      if (a.name === UNASSIGNED) return 1;
      if (b.name === UNASSIGNED) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered, groupBy]);

  const resetFilters = () => {
    setSearch("");
    setCircleId("");
    setDivisionId("");
    setSubstationId("");
    setOwnership("");
  };

  const toggleGroup = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const allExpanded = groups.length > 0 && groups.every((g) => expanded.has(g.name));

  const handleExport = () => {
    if (groupBy !== "none") {
      exportRows(
        `fuel-${groupBy}-${yearMonth}`,
        groups.map((g) => ({
          [GROUP_LABEL[groupBy]]: g.name,
          Vehicles: g.totals.vehicles,
          Entries: g.totals.entries,
          "Fuel (L)": g.totals.litres,
          "Cost (INR)": g.totals.amount,
          "Total KM": Math.round(g.totals.totalKm),
          "Company fuel KM": Math.round(g.totals.companyKm),
          "Avg (km/L)": g.totals.avg ?? "",
        })),
      );
      return;
    }
    exportRows(
      `fuel-vehicles-${yearMonth}`,
      filtered.map((r) => ({
        "FRT No": r.frtNo ?? "",
        "Reg No": r.registrationNo,
        Circle: r.circle ?? "",
        Division: r.division ?? "",
        Substation: r.substation ?? "",
        "Fuel By": r.isCompany ? "Company" : "Vendor",
        Entries: r.isCompany ? r.entries : "",
        "Fuel (L)": r.isCompany ? r.totalLitres : "",
        "Cost (INR)": r.isCompany ? r.totalAmount : "",
        "KM (GPS)": r.hasGps ? r.gpsKm : "",
        "Mileage (mo)": r.monthlyMileage.map((m) => `${m.fuelType ?? ""} ${m.breakdown.kmpl}`.trim()).join(", "),
        "All-time": r.allTimeMileage.map((m) => `${m.fuelType ?? ""} ${m.breakdown.kmpl}`.trim()).join(", "),
      })),
    );
  };

  const filterSelects = (
    <>
      <Select
        value={circleId}
        onChange={(e) => {
          setCircleId(e.target.value);
          setDivisionId("");
          setSubstationId("");
        }}
        aria-label="Circle"
      >
        <option value="">All circles</option>
        {circles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        value={divisionId}
        onChange={(e) => {
          setDivisionId(e.target.value);
          setSubstationId("");
        }}
        aria-label="Division"
      >
        <option value="">All divisions</option>
        {divisions.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>
      <Select value={substationId} onChange={(e) => setSubstationId(e.target.value)} aria-label="Substation">
        <option value="">All substations</option>
        {substations.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Select value={ownership} onChange={(e) => setOwnership(e.target.value)} aria-label="Fuel by">
        <option value="">Company + Vendor</option>
        <option value="company">Company fuelled</option>
        <option value="vendor">Vendor fuelled</option>
      </Select>
      <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} aria-label="Group by">
        <option value="none">No grouping</option>
        <option value="division">Group by division</option>
        <option value="circle">Group by circle</option>
        <option value="substation">Group by substation</option>
      </Select>
    </>
  );

  return (
    <>
      {/* Summary strip — reflects the current filters, not just the whole fleet */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-1.5">
          <Stat value={km(totals.totalKm)} label="total distance" />
          <Stat value={km(totals.companyKm)} label="company fuel distance" />
          <Stat value={totals.litres > 0 ? `${totals.litres} L` : "—"} label="total fuel" />
          <Stat value={totals.avg !== null ? `${totals.avg} km/L` : "—"} label="average" />
          <Stat value={inr(totals.amount)} label="total cost" />
          {/* Fills the empty 6th cell on mobile; the header copy handles sm+ */}
          {syncSlot}
        </div>
        {(activeFilterCount > 0 || search) && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
            <Badge tone="indigo">Filtered</Badge>
            <span>
              {totals.vehicles} of {rows.length} vehicles
            </span>
            <button type="button" onClick={resetFilters} className="font-medium text-slate-700 hover:underline">
              Clear filters
            </button>
          </p>
        )}
      </div>

      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* ── Desktop filter bar (md+) ── */}
          <div className="hidden border-b border-slate-200 bg-white p-4 md:block">
            <div className="mb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  type="search"
                  placeholder="Search by FRT no, reg no, division, substation, vendor…"
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
              <Button variant="outline" onClick={handleExport} className="h-10 shrink-0">
                <Download className="h-4 w-4" aria-hidden="true" />
                Export
              </Button>
            </div>
            <div className="grid grid-cols-5 gap-3">{filterSelects}</div>
          </div>

          {/* ── Mobile filter bar (< md) ── */}
          <div className="border-b border-slate-200 bg-white p-3 md:hidden">
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
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4" aria-hidden="true" />
                Filters &amp; totals
                {(activeFilterCount > 0 || groupBy !== "none") && (
                  <Badge tone="indigo">{activeFilterCount + (groupBy !== "none" ? 1 : 0)}</Badge>
                )}
              </span>
              {filtersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {filtersOpen && (
              <div className="mt-2 grid gap-2">
                {filterSelects}
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export {groupBy === "none" ? "vehicles" : `${GROUP_LABEL[groupBy].toLowerCase()} totals`}
                </Button>
              </div>
            )}
          </div>

          {/* Grouped view gets an expand/collapse-all control */}
          {groupBy !== "none" && groups.length > 0 && (
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-3 py-2 sm:px-5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {groups.length} {GROUP_LABEL[groupBy].toLowerCase()}
                {groups.length === 1 ? "" : "s"} · totals below
              </span>
              <button
                type="button"
                onClick={() => setExpanded(allExpanded ? new Set() : new Set(groups.map((g) => g.name)))}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
              >
                {allExpanded ? "Collapse all" : "Expand all"}
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Droplets className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">
                {rows.length === 0
                  ? "Aapke scope me koi active vehicle nahi hai"
                  : "In filters se koi vehicle match nahi hua"}
              </p>
              {rows.length > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-2 text-xs font-medium text-slate-700 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] divide-y divide-slate-200 text-xs sm:min-w-[760px] sm:text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 sm:px-5 sm:py-3">
                      {groupBy === "none" ? "Vehicle" : GROUP_LABEL[groupBy]}
                    </th>
                    <th className="px-3 py-2.5 sm:px-5 sm:py-3">Location</th>
                    <th className="px-3 py-2.5 sm:px-5 sm:py-3">Fuel By</th>
                    <th className="px-3 py-2.5 text-right sm:px-5 sm:py-3">Entries</th>
                    <th className="px-3 py-2.5 text-right sm:px-5 sm:py-3">Fuel (L)</th>
                    <th className="px-3 py-2.5 text-right sm:px-5 sm:py-3">Cost (₹)</th>
                    <th className="px-3 py-2.5 text-right sm:px-5 sm:py-3">KM (GPS)</th>
                    {/* Mileage badges stay bare numbers — a bi-fuel row shows two of
                        them, so the unit lives in the header instead. */}
                    <th className="px-3 py-2.5 text-right sm:px-5 sm:py-3">Mileage mo (km/L)</th>
                    <th className="px-3 py-2.5 text-right sm:px-5 sm:py-3">All-time (km/L)</th>
                    <th className="px-3 py-2.5 sm:px-5 sm:py-3" />
                  </tr>
                </thead>

                {groupBy === "none" ? (
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((row) => (
                      <VehicleRow key={row.vehicleId} row={row} />
                    ))}
                    <GrandTotalRow totals={totals} label="Fleet total" />
                  </tbody>
                ) : (
                  <>
                    {groups.map((group) => {
                      const isOpen = expanded.has(group.name);
                      return (
                        <tbody key={group.name} className="divide-y divide-slate-100 border-t border-slate-200">
                          <tr
                            className="cursor-pointer bg-slate-50/80 hover:bg-slate-100"
                            onClick={() => toggleGroup(group.name)}
                          >
                            <td colSpan={3} className="px-3 py-3 sm:px-5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleGroup(group.name);
                                }}
                                className="flex items-center gap-2 text-left"
                                aria-expanded={isOpen}
                              >
                                {isOpen ? (
                                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                                )}
                                <span>
                                  <span className="block font-semibold text-slate-900">{group.name}</span>
                                  <span className="text-xs text-slate-500">
                                    {group.totals.vehicles} vehicle{group.totals.vehicles === 1 ? "" : "s"}
                                  </span>
                                </span>
                              </button>
                            </td>
                            <TotalCell value={group.totals.entries} unit="entries" weight="semibold" />
                            <TotalCell value={group.totals.litres} unit="L" weight="semibold" />
                            <TotalCell value={group.totals.amount} prefix="₹" weight="semibold" />
                            <TotalCell value={Math.round(group.totals.totalKm)} unit="km" weight="semibold" />
                            <td className="px-3 py-3 text-right sm:px-5">
                              {group.totals.avg !== null ? (
                                <AvgBadge value={group.totals.avg} />
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td colSpan={2} className="px-3 py-3 sm:px-5" />
                          </tr>
                          {isOpen && group.rows.map((row) => <VehicleRow key={row.vehicleId} row={row} indented />)}
                        </tbody>
                      );
                    })}
                    <tbody>
                      <GrandTotalRow totals={totals} label="Grand total" />
                    </tbody>
                  </>
                )}
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function VehicleRow({ row, indented = false }: { row: FuelDashboardRow; indented?: boolean }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className={`px-3 py-3 sm:px-5 sm:py-3.5 ${indented ? "pl-7 sm:pl-11" : ""}`}>
        <Link href={`/vehicles/${row.vehicleId}?tab=Fuel+Logs`} className="font-semibold text-slate-900 hover:underline">
          {row.registrationNo}
        </Link>
        <p className="text-xs text-slate-400">{row.vendorName ?? "—"}</p>
      </td>
      <td className="px-3 py-3 sm:px-5 sm:py-3.5">
        <span className="block font-semibold text-slate-700">
          {row.substation ?? "—"}
          {row.frtNo ? ` (${row.frtNo})` : ""}
        </span>
        <span className="text-xs text-slate-400">{row.division ?? "Unassigned"}</span>
      </td>
      <td className="px-3 py-3 sm:px-5 sm:py-3.5">
        <Badge tone={row.isCompany ? "blue" : "yellow"}>{row.isCompany ? "Company" : "Vendor"}</Badge>
      </td>
      <td className="px-3 py-3 text-right sm:px-5 sm:py-3.5">
        {row.isCompany ? (
          <span className={row.entries > 0 ? "font-semibold text-slate-900" : "text-slate-400"}>{row.entries}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right sm:px-5 sm:py-3.5">
        {row.isCompany && row.totalLitres > 0 ? (
          <span className="whitespace-nowrap font-medium tabular-nums text-slate-900">
            {row.totalLitres}
            <Unit>L</Unit>
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right sm:px-5 sm:py-3.5">
        {row.isCompany && row.totalAmount > 0 ? (
          <span className="whitespace-nowrap font-medium tabular-nums text-slate-900">
            ₹{row.totalAmount.toLocaleString("en-IN")}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right text-slate-600 sm:px-5 sm:py-3.5">
        {row.hasGps && row.gpsKm > 0 ? (
          <span className="whitespace-nowrap font-medium tabular-nums text-slate-900">
            {row.gpsKm.toLocaleString("en-IN")}
            <Unit>km</Unit>
          </span>
        ) : row.hasGps ? (
          <span className="text-slate-400">
            0<Unit>km</Unit>
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right sm:px-5 sm:py-3.5">
        <MileageCell items={row.monthlyMileage} tone="green" label="Is mahine" />
      </td>
      <td className="px-3 py-3 text-right sm:px-5 sm:py-3.5">
        <MileageCell items={row.allTimeMileage} tone="blue" label="All-time" />
      </td>
      <td className="px-3 py-3 text-right sm:px-5 sm:py-3.5">
        {row.isCompany && row.canManage && (
          <Link
            href={`/vehicles/${row.vehicleId}?tab=Fuel+Logs`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3 w-3" />
            Add Entry
          </Link>
        )}
      </td>
    </tr>
  );
}

/** Footer row so the visible set always shows its own total. */
function GrandTotalRow({ totals, label }: { totals: Totals; label: string }) {
  return (
    <tr className="border-t-2 border-slate-300 bg-slate-100 text-slate-900">
      <td colSpan={3} className="px-3 py-3 text-xs font-bold uppercase tracking-wide sm:px-5">
        {label} · {totals.vehicles} vehicle{totals.vehicles === 1 ? "" : "s"}
      </td>
      <TotalCell value={totals.entries} unit="entries" />
      <TotalCell value={totals.litres} unit="L" />
      <TotalCell value={totals.amount} prefix="₹" />
      <TotalCell value={Math.round(totals.totalKm)} unit="km" />
      <td className="px-3 py-3 text-right sm:px-5">
        {totals.avg !== null ? <AvgBadge value={totals.avg} /> : <span className="text-slate-300">—</span>}
      </td>
      <td colSpan={2} className="px-3 py-3 sm:px-5" />
    </tr>
  );
}

/** The unit that trails a figure — small and muted so the number still leads. */
function Unit({ children }: { children: ReactNode }) {
  return <span className="ml-0.5 text-[10px] font-normal text-slate-400">{children}</span>;
}

/**
 * One numeric cell in a totals row. Totals sit away from the column header, so each
 * figure carries its own unit (₹, L, km) rather than relying on the header to say it.
 */
function TotalCell({
  value,
  unit,
  prefix,
  weight = "bold",
}: {
  value: number;
  unit?: string;
  prefix?: string;
  weight?: "bold" | "semibold";
}) {
  return (
    <td
      className={cn(
        "px-3 py-3 text-right text-slate-900 sm:px-5",
        weight === "bold" ? "font-bold" : "font-semibold",
      )}
    >
      {value > 0 ? (
        <span className="whitespace-nowrap tabular-nums">
          {prefix}
          {value.toLocaleString("en-IN")}
          {unit && <span className="ml-0.5 text-[10px] font-semibold text-slate-500">{unit}</span>}
        </span>
      ) : (
        <span className="font-normal text-slate-300">—</span>
      )}
    </td>
  );
}

/** Average badge for a totals row — the figure plus its km/L unit. */
function AvgBadge({ value }: { value: number }) {
  return (
    <Badge tone="green" className="whitespace-nowrap">
      {value}
      <span className="ml-0.5 text-[10px] font-medium opacity-70">km/L</span>
    </Badge>
  );
}

/**
 * Per-fuel-type mileage badges, each with a tooltip that spells out the calc.
 *
 * A bi-fuel vehicle (CNG to run + a small petrol dose to start) gets one badge per
 * fuel. The two numbers are not equally meaningful — the starter fuel's km/L comes
 * off a few litres — so only the dominant fuel (most litres burned) is rendered at
 * full size; the secondary one is shrunk and muted so the pair never reads as two
 * equally weighted mileages.
 */
function MileageCell({ items, tone, label }: { items: FuelMileage[]; tone: "green" | "blue"; label: string }) {
  if (items.length === 0) return <span className="text-slate-300">—</span>;
  const dominant = items.reduce((best, m) => (best.breakdown.litres >= m.breakdown.litres ? best : m));
  return (
    <div className="flex flex-col items-end gap-1">
      {items.map((item) => {
        const { fuelType, breakdown: m } = item;
        const isSecondary = item !== dominant;
        return (
          <Tooltip
            key={fuelType ?? "untyped"}
            content={
              <span className="block">
                <span className="font-semibold">
                  {fuelType ?? "Fuel"} · {label}: {m.kmpl} km/L
                </span>
                <br />
                {m.distanceKm.toLocaleString("en-IN")} km ÷ {m.litres} L
                <br />
                {formatDate(m.fromDate)} → {formatDate(m.toDate)} · {m.fills} fills
                <br />
                <span className="text-slate-400">
                  aakhri fill chhod ke{isSecondary ? " · secondary fuel" : ""}
                </span>
              </span>
            }
          >
            <Badge
              tone={tone}
              className={isSecondary ? "px-1.5 py-0.5 text-[10px] font-semibold opacity-60" : undefined}
            >
              {fuelType && (
                <span className={`mr-1 font-medium opacity-70 ${isSecondary ? "text-[8px]" : "text-[10px]"}`}>
                  {fuelType}
                </span>
              )}
              {m.kmpl}
            </Badge>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** Compact summary metric — value above label on mobile, inline on sm+. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1.5">
      <span className="text-sm font-bold tabular-nums text-slate-900 sm:text-base">{value}</span>
      <span className="text-[11px] text-slate-500 sm:text-sm">{label}</span>
    </span>
  );
}

/** Distinct {id, name} pairs from the rows, sorted by name — dropdown options. */
function uniqueOptions(rows: FuelDashboardRow[], pick: (row: FuelDashboardRow) => [string | null, string | null]) {
  const map = new Map<string, string>();
  for (const row of rows) {
    const [id, name] = pick(row);
    if (id && name && !map.has(id)) map.set(id, name);
  }
  return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
