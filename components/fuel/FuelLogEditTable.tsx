"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { QuickFuelForm, type FuelLogDraft } from "@/components/fuel/QuickFuelForm";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export type FuelLogRow = FuelLogDraft & {
  registration_no: string;
  frt_no: string | null;
  substation: string | null;
  recorded_by: string | null;
};

type VehicleOption = {
  vehicle_id: string;
  registration_no: string;
  frt_no: string | null;
  substation: string | null;
  division: string | null;
  fuel_type: string | null;
};

/** The time half of a stored fill instant, in IST. */
function formatTimeIST(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Recent fuel entries with in-place correction. The pencil opens the add form in
 * a modal, pre-filled with the saved values; the bin opens a confirmation dialog
 * before the entry is removed.
 */
export function FuelLogEditTable({
  entries,
  vehicles,
  updateAction,
  deleteAction,
  today,
}: {
  entries: FuelLogRow[];
  vehicles: VehicleOption[];
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  today: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const editing = entries.find((e) => e.id === editingId) ?? null;
  const confirming = entries.find((e) => e.id === confirmId) ?? null;

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Recent Entries</CardTitle>
            <span className="text-xs text-slate-500">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
          </div>
        </CardHeader>

        {entries.length === 0 ? (
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium text-slate-600">No fuel entries yet</p>
            <p className="mt-1 text-xs text-slate-400">Add the first entry using the form above.</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Litres</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">By</th>
                  <th className="px-4 py-3 text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {entries.map((log) => {
                  const time = formatTimeIST(log.logged_at);
                  const isOpen = editingId === log.id || confirmId === log.id;
                  return (
                    <tr key={log.id} className={cn("hover:bg-slate-50", isOpen && "bg-slate-50")}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {formatDate(log.log_date)}
                        {time && <span className="block text-xs font-normal text-slate-400">{time}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900">{log.registration_no}</span>
                        <span className="block text-xs text-slate-400">
                          {[log.frt_no, log.substation].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.fuel_type ? <Badge tone="blue">{log.fuel_type}</Badge> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{log.fuel_litres} L</td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {log.fuel_amount != null ? `₹${log.fuel_amount.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{log.recorded_by ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmId(null);
                              setEditingId(log.id);
                            }}
                            aria-label={`Edit the ${formatDate(log.log_date)} entry for ${log.registration_no}`}
                            title="Edit entry"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition hover:bg-slate-100"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setConfirmId(log.id);
                            }}
                            aria-label={`Delete the ${formatDate(log.log_date)} entry for ${log.registration_no}`}
                            title="Delete entry"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit — the add form, pre-filled, in a modal over the current screen. */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditingId(null)}
        title={editing ? `Edit Entry — ${editing.registration_no}` : "Edit Entry"}
        description={editing ? formatDate(editing.log_date) : undefined}
      >
        {editing && (
          <QuickFuelForm
            key={editing.id}
            entry={editing}
            vehicles={vehicles}
            action={updateAction}
            today={today}
            returnTo="add"
            onCancel={() => setEditingId(null)}
          />
        )}
      </Modal>

      {/* Delete — confirmation dialog; the entry is gone for good. */}
      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirmId(null)}
        title="Delete fuel entry?"
        size="sm"
        role="alertdialog"
      >
        {confirming && (
          <>
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 text-sm text-slate-600">
                <p>Ye entry permanently delete ho jayegi. Undo nahi hoga.</p>
                <dl className="mt-3 space-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <Row label="Vehicle" value={confirming.registration_no} />
                  <Row
                    label="Date"
                    value={`${formatDate(confirming.log_date)}${
                      formatTimeIST(confirming.logged_at) ? `, ${formatTimeIST(confirming.logged_at)}` : ""
                    }`}
                  />
                  <Row label="Fuel" value={`${confirming.fuel_litres} L${confirming.fuel_type ? ` · ${confirming.fuel_type}` : ""}`} />
                  <Row
                    label="Amount"
                    value={confirming.fuel_amount != null ? `₹${confirming.fuel_amount.toLocaleString("en-IN")}` : "—"}
                  />
                </dl>
              </div>
            </div>

            <form action={deleteAction} className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <input type="hidden" name="log_id" value={confirming.id} />
              <input type="hidden" name="return_to" value="add" />
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <SubmitButton variant="danger">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete Entry
              </SubmitButton>
            </form>
          </>
        )}
      </Modal>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate font-medium text-slate-800">{value}</dd>
    </div>
  );
}
