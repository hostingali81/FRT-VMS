"use client";

import { useCallback, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

/** "01 Jun 2026, 09:30 AM" → just the time half, in IST. */
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
 * Recent fuel entries with in-place correction. The pencil opens the same form
 * used to add an entry, pre-filled with the saved values; the bin removes the
 * entry after an inline confirm.
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

  // The edit card renders above a long table; bring it into view so a pencil
  // pressed near the bottom of the list doesn't look like it did nothing.
  const focusEditCard = useCallback((node: HTMLDivElement | null) => {
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <div className="space-y-4">
      {editing && (
        <div ref={focusEditCard}>
          <Card className="border-slate-900 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>
                  Edit Entry — <span className="font-mono">{editing.registration_no}</span>
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {/* key remounts the form when a different row is picked, so every
                  field re-seeds from that entry instead of keeping the last one's. */}
              <QuickFuelForm
                key={editing.id}
                entry={editing}
                vehicles={vehicles}
                action={updateAction}
                today={today}
                returnTo="add"
                onCancel={() => setEditingId(null)}
              />
            </CardContent>
          </Card>
        </div>
      )}

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
                  const isEditing = editingId === log.id;
                  const isConfirming = confirmId === log.id;
                  return (
                    <tr
                      key={log.id}
                      className={cn(
                        "hover:bg-slate-50",
                        isEditing && "bg-slate-50",
                        isConfirming && "bg-red-50 hover:bg-red-50",
                      )}
                    >
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
                        {isConfirming ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs font-medium text-red-700">Delete this entry?</span>
                            <form action={deleteAction}>
                              <input type="hidden" name="log_id" value={log.id} />
                              <input type="hidden" name="return_to" value="add" />
                              <SubmitButton variant="danger" className="h-8 px-2.5 text-xs">
                                Delete
                              </SubmitButton>
                            </form>
                            <button
                              type="button"
                              onClick={() => setConfirmId(null)}
                              className="inline-flex h-8 items-center rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmId(null);
                                setEditingId(isEditing ? null : log.id);
                              }}
                              aria-label={`Edit the ${formatDate(log.log_date)} entry for ${log.registration_no}`}
                              title="Edit entry"
                              className={cn(
                                "inline-flex h-8 w-8 items-center justify-center rounded-md border transition",
                                isEditing
                                  ? "border-slate-950 bg-slate-950 text-white"
                                  : "border-slate-300 text-slate-700 hover:bg-slate-100",
                              )}
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
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
