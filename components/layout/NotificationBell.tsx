import Link from "next/link";
import { Bell } from "lucide-react";

/**
 * Mobile-only alerts bell for the top bar. Alerts moved out of the bottom nav,
 * so this surfaces the pending count (expiring/expired documents + licenses) as
 * a notification badge that links to /alerts. Hidden on lg+ where the sidebar
 * already carries the Alerts link.
 */
export function NotificationBell({ count }: { count: number }) {
  const display = count > 99 ? "99+" : String(count);

  return (
    <Link
      href="/alerts"
      aria-label={count > 0 ? `Alerts (${count} pending)` : "Alerts"}
      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 lg:hidden"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-[1.125rem] text-white ring-2 ring-white">
          {display}
        </span>
      ) : null}
    </Link>
  );
}
