import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { CircleBreakdownTable } from "@/components/dashboard/CircleBreakdownTable";
import { DivisionBreakdownTable } from "@/components/dashboard/DivisionBreakdownTable";
import { FleetStatusChart } from "@/components/dashboard/FleetStatusChart";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { requireProfile } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const data = await getDashboardData(profile);

  return (
    <AppShell profile={profile}>
      <PageHeader title="Dashboard" eyebrow="Fleet control room" />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <SummaryCards summary={data.summary} />
        <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
          <CircleBreakdownTable rows={data.circles} />
          <ActivityFeed items={data.activity} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <FleetStatusChart rows={data.circles} />
          <DivisionBreakdownTable rows={data.divisions} />
        </div>
      </div>
    </AppShell>
  );
}
