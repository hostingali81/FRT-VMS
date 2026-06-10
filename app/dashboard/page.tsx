import Link from "next/link";
import { AlertTriangle, ArrowRight, CarFront, History, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { CircleBreakdownTable } from "@/components/dashboard/CircleBreakdownTable";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import {
  getDashboardData,
  getVehicleHistory,
  preloadActivityData,
  preloadDriverData,
  preloadFleetData,
  preloadHistoryData,
} from "@/lib/data";
import { canCreateVehicle } from "@/lib/permissions";
import type { VehicleHistoryItem } from "@/lib/types";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Start the data queries while the auth round trips are still in flight.
  preloadFleetData();
  preloadHistoryData();
  preloadDriverData();
  preloadActivityData();
  const profile = await requireProfile();
  const [data, history] = await Promise.all([getDashboardData(profile), getVehicleHistory(profile)]);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Dashboard" eyebrow="Simple fleet overview">
        <LinkButton href="/vehicle-history" variant="secondary">
          <History className="h-4 w-4" aria-hidden="true" />
          Vehicle History
        </LinkButton>
        <LinkButton href="/vehicles">
          <CarFront className="h-4 w-4" aria-hidden="true" />
          Vehicles
        </LinkButton>
      </PageHeader>
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <SummaryCards summary={data.summary} />
        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <RecentVehicleHistory items={history.slice(0, 6)} />
          <MainWorkLinks canCreate={canCreateVehicle(profile)} />
        </div>
        <div>
          <CircleBreakdownTable rows={data.circles} />
        </div>
      </div>
    </AppShell>
  );
}

function MainWorkLinks({ canCreate }: { canCreate: boolean }) {
  const links = [
    ...(canCreate ? [{ href: "/vehicles/new", label: "Add Vehicle", icon: Plus }] : []),
    { href: "/vehicle-history", label: "Vehicle History", icon: History },
    { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Main Work</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                {item.label}
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RecentVehicleHistory({ items }: { items: VehicleHistoryItem[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Recent Vehicle History</CardTitle>
        <Link href="/vehicle-history" className="text-sm font-semibold text-slate-700 hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No vehicle history recorded.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <article key={item.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[7rem_1fr] sm:px-5">
                <div className="text-sm font-semibold text-slate-700">{formatDate(item.event_date)}</div>
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/vehicles/${item.vehicle_id}`} className="font-semibold text-slate-950 hover:underline">
                      {item.registration_no}
                    </Link>
                    <Badge tone={historyTone(item)}>{historyLabel(item)}</Badge>
                  </div>
                  <p className="break-words text-sm text-slate-600">
                    {item.from_location ?? "Not recorded"} <span className="text-slate-400">to</span>{" "}
                    {item.to_location ?? item.category}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function historyLabel(item: VehicleHistoryItem) {
  if (item.event_type === "transfer") return item.is_cross_circle ? "Circle Change" : "Location Change";
  if (item.status === "removed") return "Permanent Removed";
  if (item.status === "active") return "Active Again";
  return "Temporary Removed";
}

function historyTone(item: VehicleHistoryItem): "green" | "yellow" | "red" | "gray" | "blue" | "indigo" {
  if (item.event_type === "transfer") return item.is_cross_circle ? "indigo" : "blue";
  if (item.status === "removed") return "gray";
  if (item.status === "active") return "green";
  return "yellow";
}
