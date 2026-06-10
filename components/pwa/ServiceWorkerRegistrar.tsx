"use client";

import { RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Registers the service worker (production only) and surfaces an "Update
 * available" prompt to already-installed users when a new version ships.
 *
 * Flow: a new sw.js waits (it no longer auto-skipWaiting). We detect the waiting
 * worker, show a prompt, and on accept post SKIP_WAITING so it activates — then
 * reload once it takes control to load the fresh assets.
 */
export function ServiceWorkerRegistrar() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | undefined;

    // Only an update when a worker already controls the page (not a first install).
    const offerUpdate = (worker: ServiceWorker | null) => {
      if (worker && navigator.serviceWorker.controller) setWaiting(worker);
    };

    const onLoad = async () => {
      try {
        reg = await navigator.serviceWorker.register("/sw.js");

        if (reg.waiting) offerUpdate(reg.waiting);

        reg.addEventListener("updatefound", () => {
          const next = reg?.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed") offerUpdate(next);
          });
        });
      } catch {
        /* registration failed — ignore */
      }
    };

    // Catch updates published while the app stays open/backgrounded.
    const onVisible = () => {
      if (document.visibilityState === "visible") reg?.update().catch(() => {});
    };

    window.addEventListener("load", onLoad);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("load", onLoad);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const applyUpdate = () => {
    if (!waiting) return;
    // Reload exactly once, when the new worker takes control of the page.
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true },
    );
    waiting.postMessage({ type: "SKIP_WAITING" });
    setWaiting(null);
  };

  if (!waiting) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl ring-1 ring-black/5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Update available</p>
          <p className="mt-0.5 text-xs text-slate-500">A new version of FRT-VMS is ready.</p>
        </div>
        <button
          type="button"
          onClick={applyUpdate}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Update
        </button>
        <button
          type="button"
          onClick={() => setWaiting(null)}
          aria-label="Dismiss"
          className="flex-shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
