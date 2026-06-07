import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  backHref,
  badge,
  children,
}: {
  title: string;
  eyebrow?: string;
  backHref?: string;
  /** Status indicator shown beside the title (e.g. a StatusBadge), kept out of the action row. */
  badge?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="break-words text-xl font-semibold text-slate-950 sm:text-2xl">{title}</h1>
            {badge}
          </div>
        </div>
        {children ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center [&>a]:w-full [&>button]:w-full sm:[&>a]:w-auto sm:[&>button]:w-auto">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
