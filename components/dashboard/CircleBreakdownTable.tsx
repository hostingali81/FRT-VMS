import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CircleSummary } from "@/lib/types";

export function CircleBreakdownTable({ rows }: { rows: CircleSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Circle-Wise Fleet</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="min-w-[650px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-5 py-3">Circle</th>
              <th className="px-5 py-3 text-right">Vehicles</th>
              <th className="px-5 py-3 text-right">Active</th>
              <th className="px-5 py-3 text-right">Attention</th>
              <th className="px-5 py-3 text-right">Docs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={row.circle_id} className="hover:bg-slate-50">
                <td data-label="Circle" className="px-5 py-4 font-medium text-slate-950">
                  <Link href={`/vehicles?circle=${row.circle_id}`} className="hover:underline">
                    {row.circle}
                  </Link>
                </td>
                <td data-label="Vehicles" className="px-5 py-4 text-right">{row.total}</td>
                <td data-label="Active" className="px-5 py-4 text-right text-emerald-700">{row.active}</td>
                <td data-label="Attention" className="px-5 py-4 text-right text-red-700">{row.maintenance + row.breakdown}</td>
                <td data-label="Documents" className="px-5 py-4 text-right">
                  <Badge tone={row.documents_expiring > 0 ? "yellow" : "green"}>{row.documents_expiring}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
