import { Loader2 } from "lucide-react";

// Lightweight, recharts-free skeleton. Lives in its own module so LiveTracking
// can render it (as the dynamic-import fallback) without statically pulling
// recharts into the server bundle — that's the whole point of loading the donut
// with ssr:false.
export function DonutSkeleton() {
  return (
    <div className="mx-auto flex h-[300px] w-full max-w-[420px] items-center justify-center">
      <div className="relative grid place-items-center">
        <div className="h-[248px] w-[248px] animate-pulse rounded-full border-[31px] border-slate-100" />
        <Loader2 className="absolute h-7 w-7 animate-spin text-slate-300" aria-hidden="true" />
      </div>
    </div>
  );
}
