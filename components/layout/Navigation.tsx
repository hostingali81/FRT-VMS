"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  BarChart3,
  CarFront,
  Gauge,
  History,
  Menu,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/vehicles", label: "Vehicles", icon: CarFront },
  { href: "/drivers", label: "Drivers", icon: UserRound },
  { href: "/vehicle-history", label: "Vehicle History", icon: History },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin", label: "Admin", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();
  const visibleNav = navItems.filter((item) => item.href !== "/admin" || showAdmin);

  return (
    <nav className="space-y-1 px-3 py-4">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href) || (item.href === "/vehicle-history" && pathname.startsWith("/transfers"));

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({ showAdmin }: { showAdmin: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close menu when pathname changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  const visibleNav = navItems.filter((item) => item.href !== "/admin" || showAdmin);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700"
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transform bg-white shadow-xl transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">FRT-VMS</p>
            <p className="text-sm font-bold text-slate-950">Imperial Electric</p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="space-y-1 p-3">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href) || (item.href === "/vehicle-history" && pathname.startsWith("/transfers"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition",
                  active
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

