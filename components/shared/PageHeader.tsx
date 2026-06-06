import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  backHref,
  children,
}: {
  title: string;
  eyebrow?: string;
  backHref?: string;
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
          <h1 className="mt-1 break-words text-xl font-semibold text-slate-950 sm:text-2xl">{title}</h1>
        </div>
        {children ? (
          <div className="flex w-full flex-wrap gap-2 [&>a]:flex-1 [&>button]:flex-1 sm:w-auto sm:[&>a]:flex-none sm:[&>button]:flex-none">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
