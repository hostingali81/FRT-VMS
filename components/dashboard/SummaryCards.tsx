import { AlertTriangle, CarFront, CircleDot, ShieldCheck, UsersRound, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const icons = {
  circles: CircleDot,
  vehicles: CarFront,
  active: ShieldCheck,
  issue: Wrench,
  alerts: AlertTriangle,
  drivers: UsersRound,
};

export function SummaryCards({
  summary,
}: {
  summary: {
    totalCircles: number;
    totalVehicles: number;
    activeVehicles: number;
    maintenanceOrBreakdown: number;
    expiringDocs: number;
    activeDrivers: number;
  };
}) {
  const items = [
    { label: "Total Circles", value: summary.totalCircles, icon: "circles" as const },
    { label: "Total Vehicles", value: summary.totalVehicles, icon: "vehicles" as const },
    { label: "Active Vehicles", value: summary.activeVehicles, icon: "active" as const },
    { label: "Maintenance / Breakdown", value: summary.maintenanceOrBreakdown, icon: "issue" as const },
    { label: "Docs Expiring", value: summary.expiringDocs, icon: "alerts" as const },
    { label: "Active Drivers", value: summary.activeDrivers, icon: "drivers" as const },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map((item) => {
        const Icon = icons[item.icon];
        return (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{item.value}</p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

