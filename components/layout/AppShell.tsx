import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/lib/actions/auth-actions";
import { formatScope, requireProfile, ROLE_LABELS } from "@/lib/auth";
import { MobileNav, SidebarNav } from "@/components/layout/Navigation";
import { getLookups } from "@/lib/data";
import { canOpenAdmin } from "@/lib/permissions";
import type { UserProfile } from "@/lib/types";

export async function AppShell({ children, profile }: { children: ReactNode; profile?: UserProfile }) {
  const activeProfile = profile ?? (await requireProfile());
  const lookups = await getLookups(activeProfile);
  const showAdmin = canOpenAdmin(activeProfile);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="border-b border-slate-200 px-5 py-5">
          <Link href="/dashboard" className="block">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imperial Electric</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">FRT-VMS</p>
          </Link>
        </div>
        <SidebarNav showAdmin={showAdmin} />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">{formatScope(activeProfile, lookups)}</p>
              <p className="text-xs text-slate-500">
                {activeProfile.name} / {ROLE_LABELS[activeProfile.role]}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <MobileNav showAdmin={showAdmin} />
              <form action={logoutAction}>
                <button className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  Logout
                </button>
              </form>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
