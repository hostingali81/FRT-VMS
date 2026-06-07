import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "border-slate-950 bg-slate-950 text-white hover:bg-slate-800",
  secondary: "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
  outline: "border-slate-300 bg-transparent text-slate-900 hover:bg-slate-100",
  ghost: "border-transparent bg-transparent text-slate-700 hover:bg-slate-100",
  danger: "border-red-700 bg-red-700 text-white hover:bg-red-800",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: Variant;
  children: ReactNode;
};

export function LinkButton({ className, variant = "primary", href, ...props }: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-400",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

const iconSizes: Record<"sm" | "md", string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
};

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
  children: ReactNode;
};

/** Square, icon-only button (no text). Use for toolbar/pagination/menu controls. */
export function IconButton({ className, variant = "outline", size = "md", ...props }: IconButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md border transition focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-40",
        iconSizes[size],
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

type DashedButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

/** Full-width dashed-outline button used to reveal an inline "add" form. */
export function DashedButton({ className, ...props }: DashedButtonProps) {
  return (
    <button
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50",
        className,
      )}
      {...props}
    />
  );
}

