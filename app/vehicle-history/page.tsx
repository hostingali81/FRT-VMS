import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { requireProfile } from "@/lib/auth";
import { getVehicleHistory } from "@/lib/data";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function VehicleHistoryPage() {
  const profile = await requireProfile();
  const history = await getVehicleHistory(profile);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Vehicle History" eyebrow="Movement, removal and status history" />
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-white px-5 py-4">
            <p className="text-sm text-slate-600">
              {history.length} records across substation movements, cross-circle transfers, temporary removals and permanent removals.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Vehicle</th>
                  <th className="px-5 py-3">History Type</th>
                  <th className="px-5 py-3">From</th>
                  <th className="px-5 py-3">To / Result</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">By</th>
                  <th className="px-5 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-4">{formatDate(item.event_date)}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">
                      <Link href={`/vehicles/${item.vehicle_id}`} className="hover:underline">
                        {item.registration_no}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      {item.status ? (
                        <div className="space-y-1">
                          <StatusBadge status={item.status} />
                          <p className="text-xs font-medium text-slate-500">{item.category}</p>
                        </div>
                      ) : (
                        <Badge tone={item.is_cross_circle ? "indigo" : "blue"}>{item.category}</Badge>
                      )}
                    </td>
                    <td className="min-w-56 px-5 py-4 text-slate-600">{item.from_location ?? "Not recorded"}</td>
                    <td className="min-w-56 px-5 py-4 text-slate-600">{item.to_location ?? item.category}</td>
                    <td className="px-5 py-4 text-slate-600">{item.reason ?? "Not recorded"}</td>
                    <td className="px-5 py-4 text-slate-600">{item.approved_or_recorded_by ?? "Not recorded"}</td>
                    <td className="min-w-64 px-5 py-4 text-slate-600">{item.remarks ?? "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

