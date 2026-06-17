import { cn } from "@/lib/utils/cn";

/**
 * Lightweight CSS-only tooltip — no client JS, so it renders in Server Components too.
 * Shows on hover (desktop) and on keyboard/tap focus (the wrapper is focusable), so it
 * also works on touch devices.
 */
export function Tooltip({
  content,
  children,
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex items-center", className)} tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className="invisible absolute bottom-full left-1/2 z-30 mb-1.5 w-max max-w-[15rem] -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
