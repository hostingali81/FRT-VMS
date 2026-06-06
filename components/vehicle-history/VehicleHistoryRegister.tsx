"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import type { VehicleHistoryItem, VehicleStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils/format";

const PAGE_SIZE = 50;

type HistoryFilter = "all" | "movement" | "temporary" | "removed" | "active";
type BadgeTone = "green" | "yellow" | "red" | "gray" | "blue" | "indigo";

export function VehicleHistoryRegister({ history }: { history: VehicleHistoryItem[] }) {
  const [queryInput, setQueryInput] = useState("");
  const [typeInput, setTypeInput] = useState<HistoryFilter>("all");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<HistoryFilter>("all");
  const [page, setPage] = useState(1);

  const filteredHistory = useMemo(() => filterHistory(history, query, type), [history, query, type]);

  useEffect(() => { setPage(1); }, [filteredHistory]);

  const paginatedHistory = useMemo(
    () => filteredHistory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredHistory, page],
  );
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(queryInput.trim());
    setType(typeInput);
  }

  function handleClear() {
    setQueryInput("");
    setTypeInput("all");
    setQuery("");
    setType("all");
  }

  return (
    <>
      <HistoryFilters
        query={queryInput}
        type={typeInput}
        onQueryChange={setQueryInput}
        onTypeChange={setTypeInput}
        onSearch={handleSearch}
        onClear={handleClear}
      />
      <HistoryTable
        items={paginatedHistory}
        filtered={filteredHistory.length}
        total={history.length}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </>
  );
}

function HistoryFilters({
  query,
  type,
  onQueryChange,
  onTypeChange,
  onSearch,
  onClear,
}: {
  query: string;
  type: HistoryFilter;
  onQueryChange: (value: string) => void;
  onTypeChange: (value: HistoryFilter) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={onSearch} className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_14rem_auto_auto]">
          <div className="space-y-2">
            <Label htmlFor="history-search">Search</Label>
            <Input
              id="history-search"
              name="q"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Vehicle no, place, reason"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="history-type">Show</Label>
            <Select
              id="history-type"
              name="type"
              value={type}
              onChange={(event) => onTypeChange(filterValue(event.target.value))}
            >
              <option value="all">All history</option>
              <option value="movement">Location changed</option>
              <option value="temporary">Temporary removed</option>
              <option value="removed">Permanent removed</option>
              <option value="active">Active again</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full lg:w-auto">
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </Button>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="secondary" className="w-full lg:w-auto" onClick={onClear}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function HistoryTable({
  items,
  filtered,
  total,
  page,
  totalPages,
  onPageChange,
}: {
  items: VehicleHistoryItem[];
  filtered: number;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const start = filtered === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, filtered);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 sm:px-5">
        <CardTitle>History Table</CardTitle>
        <Badge tone="gray">
          {filtered === total ? `${total} records` : `${filtered} of ${total}`}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No matching history found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">From</th>
                    <th className="px-4 py-3">To / Status</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">By</th>
                    <th className="px-4 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item) => (
                    <tr key={item.id} className="align-top hover:bg-slate-50">
                      <td data-label="Date" className="whitespace-nowrap px-4 py-4 font-semibold text-slate-950">{formatDate(item.event_date)}</td>
                      <td data-label="Vehicle" className="whitespace-nowrap px-4 py-4">
                        <Link href={`/vehicles/${item.vehicle_id}`} className="font-semibold text-slate-950 hover:underline">
                          {item.registration_no}
                        </Link>
                      </td>
                      <td data-label="Action" className="whitespace-nowrap px-4 py-4">
                        <Badge tone={actionTone(item)}>{actionText(item)}</Badge>
                      </td>
                      <td data-label="From" className="min-w-56 px-4 py-4 text-slate-700">{plainText(item.from_location)}</td>
                      <td data-label="To / Status" className="min-w-56 px-4 py-4 font-medium text-slate-800">{resultText(item)}</td>
                      <td data-label="Reason" className="min-w-44 px-4 py-4 text-slate-700">{reasonText(item)}</td>
                      <td data-label="By" className="min-w-40 px-4 py-4 text-slate-700">{plainText(item.approved_or_recorded_by)}</td>
                      <td data-label="Remarks" className="min-w-56 px-4 py-4 text-slate-600">{plainText(item.remarks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 sm:px-5">
                <p className="text-sm text-slate-500">
                  Showing {start}–{end} of {filtered}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    aria-label="Previous page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[5rem] text-center text-sm text-slate-600">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages}
                    aria-label="Next page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function filterValue(value: string): HistoryFilter {
  if (value === "movement" || value === "temporary" || value === "removed" || value === "active") return value;
  return "all";
}

function filterHistory(items: VehicleHistoryItem[], query: string, type: HistoryFilter) {
  const needle = query.toLowerCase();

  return items.filter((item) => {
    const matchesType =
      type === "all" ||
      (type === "movement" && item.event_type === "transfer") ||
      (type === "temporary" && isTemporaryRemoval(item)) ||
      (type === "removed" && item.status === "removed") ||
      (type === "active" && item.status === "active");

    if (!matchesType) return false;
    if (!needle) return true;

    return [
      item.registration_no,
      actionText(item),
      item.from_location,
      resultText(item),
      reasonText(item),
      item.approved_or_recorded_by,
      item.remarks,
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(needle));
  });
}

function actionText(item: VehicleHistoryItem) {
  if (item.event_type === "transfer") return item.is_cross_circle ? "Circle changed" : "Location changed";
  if (item.status === "removed") return "Permanent removed";
  if (item.status === "active") return "Active again";
  return "Temporary removed";
}

function actionTone(item: VehicleHistoryItem): BadgeTone {
  if (item.event_type === "transfer") return item.is_cross_circle ? "indigo" : "blue";
  if (item.status === "removed") return "gray";
  if (item.status === "active") return "green";
  return "yellow";
}

function resultText(item: VehicleHistoryItem) {
  if (item.event_type === "transfer") return plainText(item.to_location);
  if (item.status === "removed") return "Removed permanently";
  if (item.status === "active") return "Active";
  return statusResult(item.status);
}

function reasonText(item: VehicleHistoryItem) {
  if (item.event_type === "transfer") return plainText(item.reason);
  if (item.status === "removed") return "Permanent removal";
  if (item.status === "active") return "Vehicle active again";
  return statusResult(item.status);
}

function statusResult(status: VehicleStatus | null) {
  if (status === "maintenance") return "In maintenance";
  if (status === "breakdown") return "Breakdown";
  if (status === "standby") return "Standby";
  if (status === "accident") return "Accident";
  return "Not recorded";
}

function isTemporaryRemoval(item: VehicleHistoryItem) {
  return item.event_type === "status" && Boolean(item.status) && item.status !== "active" && item.status !== "removed";
}

function plainText(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "Not recorded";
}
