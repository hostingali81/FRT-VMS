import Link from "next/link";
import type { ReactNode } from "react";
import { formatScope, requireProfile, ROLE_LABELS } from "@/lib/auth";
import { BottomNav, LogoutButton, MobileNav, SidebarNav } from "@/components/layout/Navigation";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { getAlertsData, getLookups } from "@/lib/data";
import { canOpenAdmin } from "@/lib/permissions";
import type { UserProfile } from "@/lib/types";

export async function AppShell({ children, profile }: { children: ReactNode; profile?: UserProfile }) {
  const activeProfile = profile ?? (await requireProfile());
  // getAlertsData reuses the cached getVehicles/getDrivers, so the bell count is
  // near-free on pages that already load the fleet.
  const [lookups, alerts] = await Promise.all([getLookups(activeProfile), getAlertsData(activeProfile)]);
  const alertCount = alerts.documentAlerts.length + alerts.driverLicenseAlerts.length;
  const showAdmin = canOpenAdmin(activeProfile);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-5 py-5">
          <Link href="/" className="block">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imperial Electric</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">FRT-VMS</p>
          </Link>
        </div>
        <SidebarNav showAdmin={showAdmin} />
        <div className="mt-auto border-t border-slate-200 bg-slate-50">
          <LogoutButton />
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* z-40 keeps the header — and the mobile drawer/overlay it renders — above
            the fixed bottom nav (z-30) so the drawer fully covers it (logout stays
            tappable). */}
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <MobileNav showAdmin={showAdmin} />
              <Link href="/profile" className="min-w-0 rounded-md outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-slate-300">
                <p className="truncate text-xs font-semibold uppercase text-slate-500 lg:hidden">FRT-VMS</p>
                <p className="truncate text-sm font-semibold text-slate-950">{formatScope(activeProfile, lookups)}</p>
                <p className="hidden truncate text-xs text-slate-500 sm:block">
                  {activeProfile.name} / {ROLE_LABELS[activeProfile.role]}
                </p>
              </Link>
            </div>
            <NotificationBell count={alertCount} />
          </div>
        </header>
        {/* Bottom padding clears the fixed bottom nav (≈69px) plus the device
            safe-area inset so page content is never hidden behind it on mobile. */}
        <main className="pb-[calc(5rem_+_env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
