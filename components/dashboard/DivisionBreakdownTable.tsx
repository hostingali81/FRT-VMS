import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DivisionSummary } from "@/lib/types";

export function DivisionBreakdownTable({ rows }: { rows: DivisionSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Division Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Division</th>
              <th className="px-5 py-3">Circle</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-right">Active</th>
              <th className="px-5 py-3 text-right">Issues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={row.division_id}>
                <td className="px-5 py-4 font-medium text-slate-950">{row.division}</td>
                <td className="px-5 py-4 text-slate-600">{row.circle}</td>
                <td className="px-5 py-4 text-right">{row.total}</td>
                <td className="px-5 py-4 text-right text-emerald-700">{row.active}</td>
                <td className="px-5 py-4 text-right text-red-700">{row.maintenance + row.breakdown}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

