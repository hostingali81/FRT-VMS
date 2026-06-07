import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentYearMonth, monthLabel, nextMonth, prevMonth } from "@/lib/utils/month";

/** Server component — prev/next month links for fuel pages. */
export function MonthNavigator({ basePath, yearMonth }: { basePath: string; yearMonth: string }) {
  const isCurrentMonth = yearMonth === currentYearMonth();

  return (
    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
      <Link
        href={`${basePath}?m=${prevMonth(yearMonth)}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <span className="min-w-[140px] text-center text-sm font-semibold text-slate-900">
        {monthLabel(yearMonth)}
      </span>
      <Link
        href={`${basePath}?m=${nextMonth(yearMonth)}`}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 ${isCurrentMonth ? "pointer-events-none opacity-40" : ""}`}
        aria-label="Next month"
        aria-disabled={isCurrentMonth}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
      {!isCurrentMonth && (
        <Link
          href={basePath}
          className="ml-1 text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline"
        >
          Back to current month
        </Link>
      )}
    </div>
  );
}
