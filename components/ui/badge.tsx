import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "green" | "yellow" | "red" | "gray" | "blue" | "slate" | "indigo";

const tones: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  yellow: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  slate: "bg-slate-950 text-white ring-slate-950",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

export function Badge({ className, tone = "gray", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold leading-none ring-1 ring-inset",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

