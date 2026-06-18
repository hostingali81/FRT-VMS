"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CarFront,
  CircleUserRound,
  ClipboardList,
  Droplets,
  Gauge,
  History,
  Loader2,
  LogOut,
  Menu,
  Radio,
  Route,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth-actions";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/vehicles", label: "Vehicles", icon: CarFront },
  { href: "/live", label: "Live Tracking", icon: Radio },
  { href: "/drivers", label: "Drivers", icon: UserRound },
  { href: "/fuel", label: "Fuel Dashboard", icon: Droplets },
  { href: "/fuel-log", label: "Fuel Log", icon: ClipboardList },
  { href: "/gps-distance", label: "GPS Distance", icon: Route },
  { href: "/vehicle-history", label: "Vehicle History", icon: History },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/profile", label: "Profile", icon: CircleUserRound },
  { href: "/admin", label: "Admin", icon: Settings },
];

// Four primary destinations surfaced as a fixed bottom bar on mobile for
// one-tap access. Everything else stays in the hamburger drawer.
const bottomNavItems = [
  { href: "/fuel", label: "Fuel", icon: Droplets },
  { href: "/vehicles", label: "Vehicles", icon: CarFront },
  { href: "/fuel-log", label: "Fuel Log", icon: ClipboardList },
  { href: "/live", label: "Live", icon: Radio },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const visibleNav = navItems.filter((item) => item.href !== "/admin" || showAdmin);

  return (
    <nav className="space-y-1 px-3 py-4">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        const active =
          isActive(pathname, item.href) ||
          (item.href === "/vehicle-history" && pathname.startsWith("/transfers"));
        const pending = pendingHref === item.href && !active;

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={() => { if (!active) setPendingHref(item.href); }}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active || pending
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
            )}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Icon className="h-4 w-4" aria-hidden="true" />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function LogoutButton({ mobile = false }: { mobile?: boolean }) {
  return (
    <form action={logoutAction} className="p-3">
      <button
        type="submit"
        className={cn(
          "group flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200",
          mobile ? "py-3 text-base" : "py-2.5 text-sm",
        )}
      >
        <LogOut
          className={cn("transition-transform group-hover:-translate-x-0.5", mobile ? "h-5 w-5" : "h-4 w-4")}
          aria-hidden="true"
        />
        Sign out
      </button>
    </form>
  );
}

export function MobileNav({ showAdmin }: { showAdmin: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const visibleNav = navItems.filter((item) => item.href !== "/admin" || showAdmin);

  return (
    <div className="lg:hidden">
      <IconButton
        type="button"
        variant="secondary"
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
        aria-expanded={isOpen}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </IconButton>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-2rem))] transform flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">FRT-VMS</p>
            <p className="text-sm font-bold text-slate-950">Imperial Electric</p>
          </div>
          <IconButton
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active =
              isActive(pathname, item.href) ||
              (item.href === "/vehicle-history" && pathname.startsWith("/transfers"));
            const pending = pendingHref === item.href && !active;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => { if (!active) setPendingHref(item.href); }}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition-colors",
                  active || pending
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
                )}
              >
                {pending ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Icon className="h-5 w-5" aria-hidden="true" />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 bg-slate-50">
          <LogoutButton mobile />
        </div>
      </div>
    </div>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Primary"
    >
      <div className="grid grid-cols-4">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          const pending = pendingHref === item.href && !active;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onClick={() => { if (!active) setPendingHref(item.href); }}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-slate-500"
            >
              <span
                className={cn(
                  "flex h-8 w-16 items-center justify-center rounded-full transition-colors",
                  active || pending ? "bg-slate-950 text-white" : "text-slate-500",
                )}
              >
                {pending ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Icon className="h-5 w-5" aria-hidden="true" />
                )}
              </span>
              <span className={cn(active || pending ? "text-slate-950" : "text-slate-500")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
