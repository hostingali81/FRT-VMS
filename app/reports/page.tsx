import { Download } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { requireProfile } from "@/lib/auth";
import { getCircleSummaries, getTransfers, getVehicles } from "@/lib/data";

export const dynamic = "force-dynamic";

const reports = [
  "Circle-wise Deployment Summary",
  "Vehicle Movement Report",
  "Cross-Circle Transfer Report",
  "Driver Duty Report",
  "Document Compliance Report",
  "Vendor Fleet Report",
  "Division-wise Active Fleet",
];

export default async function ReportsPage() {
  const profile = await requireProfile();
  const [circles, transfers, vehicles] = await Promise.all([getCircleSummaries(profile), getTransfers(profile), getVehicles(profile)]);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Reports" eyebrow="Exports and compliance views" />
      <div className="grid gap-4 px-4 py-5 sm:px-6 lg:px-8 xl:grid-cols-[22rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Report Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reports.map((report) => (
              <button key={report} className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
                {report}
                <Download className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Circle-Wise Deployment Summary</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Circle</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3 text-right">Active</th>
                    <th className="px-5 py-3 text-right">Issues</th>
                    <th className="px-5 py-3 text-right">Docs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {circles.map((circle) => (
                    <tr key={circle.circle_id}>
                      <td className="px-5 py-4 font-semibold text-slate-950">{circle.circle}</td>
                      <td className="px-5 py-4 text-right">{circle.total}</td>
                      <td className="px-5 py-4 text-right">{circle.active}</td>
                      <td className="px-5 py-4 text-right">{circle.maintenance + circle.breakdown}</td>
                      <td className="px-5 py-4 text-right">{circle.documents_expiring}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <MiniStat label="Total transfers" value={transfers.length} />
            <MiniStat label="Cross-circle" value={transfers.filter((transfer) => transfer.is_cross_circle).length} />
            <MiniStat label="Vendors" value={new Set(vehicles.map((vehicle) => vehicle.vendor_name).filter(Boolean)).size} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
      </CardContent>
    </Card>
  );
}
