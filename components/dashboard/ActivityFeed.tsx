import { RefreshCcw, Wrench } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityItem } from "@/lib/types";
import { formatDateTime } from "@/lib/utils/format";

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item) => {
            const Icon = item.activity_type === "transfer" ? RefreshCcw : Wrench;
            return (
              <div key={item.id} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <Link href={`/vehicles/${item.vehicle_id}`} className="text-sm font-semibold text-slate-950 hover:underline">
                    {item.registration_no}
                  </Link>
                  <p className="mt-0.5 text-sm text-slate-600">{item.description}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(item.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

