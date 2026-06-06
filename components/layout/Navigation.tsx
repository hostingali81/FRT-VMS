"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CarFront,
  Gauge,
  History,
  Loader2,
  LogOut,
  Menu,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth-actions";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/vehicles", label: "Vehicles", icon: CarFront },
  { href: "/drivers", label: "Drivers", icon: UserRound },
  { href: "/vehicle-history", label: "Vehicle History", icon: History },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/admin", label: "Admin", icon: Settings },
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
          "flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-3 font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950",
          mobile ? "py-3 text-base" : "py-2 text-sm",
        )}
      >
        <LogOut className={mobile ? "h-5 w-5" : "h-4 w-4"} aria-hidden="true" />
        Logout
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
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-800"
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
        aria-expanded={isOpen}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

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
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
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
