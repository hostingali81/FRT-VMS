"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "border-slate-950 bg-slate-950 text-white hover:bg-slate-800",
  secondary: "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
  outline: "border-slate-300 bg-transparent text-slate-900 hover:bg-slate-100",
  ghost: "border-transparent bg-transparent text-slate-700 hover:bg-slate-100",
  danger: "border-red-700 bg-red-700 text-white hover:bg-red-800",
};

export function SubmitButton({
  children,
  className,
  variant = "primary",
  disabled = false,
  title,
}: {
  children: ReactNode;
  className?: string;
  variant?: Variant;
  /** Blocks submission on top of the automatic pending state (e.g. a required field is still empty). */
  disabled?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      title={title}
      disabled={pending || disabled}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
