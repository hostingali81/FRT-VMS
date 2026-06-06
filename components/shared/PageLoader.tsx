import { Truck } from "lucide-react";

export function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Sidebar shell */}
      <div className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-5 w-20 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="flex-1 space-y-1 p-3 pt-4">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-9 animate-pulse rounded-md bg-slate-100"
              style={{ animationDelay: `${i * 60}ms`, opacity: 1 - i * 0.08 }}
            />
          ))}
        </div>
        <div className="border-t border-slate-200 p-3">
          <div className="h-9 animate-pulse rounded-md bg-slate-100" />
        </div>
      </div>

      {/* Main area */}
      <div className="lg:pl-64">
        {/* Header shell */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-md bg-slate-100 lg:hidden" />
            <div className="space-y-1.5">
              <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
              <div className="hidden h-3 w-40 animate-pulse rounded bg-slate-100 sm:block" />
            </div>
          </div>
        </div>

        {/* Fleet loader */}
        <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
          <div className="flex flex-col items-center gap-5">
            {/* Radar rings */}
            <div className="relative flex h-28 w-28 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full border border-blue-200"
                style={{ animation: "fleet-ping 2s cubic-bezier(0,0,0.2,1) infinite" }}
              />
              <span
                className="absolute inset-4 rounded-full border border-blue-300"
                style={{ animation: "fleet-ping 2s cubic-bezier(0,0,0.2,1) infinite 400ms" }}
              />
              <span
                className="absolute inset-8 rounded-full border border-blue-400"
                style={{ animation: "fleet-ping 2s cubic-bezier(0,0,0.2,1) infinite 800ms" }}
              />
              <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md">
                <Truck className="h-7 w-7 text-slate-600" strokeWidth={1.5} />
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Imperial Electric
              </p>
              <p className="mt-1 text-sm font-medium text-slate-500">FRT-VMS</p>
            </div>

            {/* Animated dots */}
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-blue-400"
                  style={{ animation: `fleet-bounce 1.2s ease-in-out infinite ${i * 200}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fleet-ping {
          0% { transform: scale(1); opacity: 0.6; }
          80%, 100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes fleet-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
