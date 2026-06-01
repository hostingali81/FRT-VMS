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
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Circle</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-right">Active</th>
              <th className="px-5 py-3 text-right">Maintenance</th>
              <th className="px-5 py-3 text-right">Breakdown</th>
              <th className="px-5 py-3 text-right">Expiring Docs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={row.circle_id} className="hover:bg-slate-50">
                <td className="px-5 py-4 font-medium text-slate-950">
                  <Link href={`/vehicles?circle=${row.circle_id}`} className="hover:underline">
                    {row.circle}
                  </Link>
                </td>
                <td className="px-5 py-4 text-right">{row.total}</td>
                <td className="px-5 py-4 text-right text-emerald-700">{row.active}</td>
                <td className="px-5 py-4 text-right text-amber-700">{row.maintenance}</td>
                <td className="px-5 py-4 text-right text-red-700">{row.breakdown}</td>
                <td className="px-5 py-4 text-right">
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

