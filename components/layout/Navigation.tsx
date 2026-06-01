"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  CarFront,
  Gauge,
  History,
  Settings,
  UserRound,
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
  const pathname = usePathname();
  const visibleNav = navItems.filter((item) => item.href !== "/admin" || showAdmin);

  return (
    <nav className="flex gap-1 overflow-x-auto lg:hidden">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href) || (item.href === "/vehicle-history" && pathname.startsWith("/transfers"));

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition",
              active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
            title={item.label}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

