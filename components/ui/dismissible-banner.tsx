"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A full-width notice banner that auto-dismisses after `timeout` ms.
 * Used for sync result toasts so they fade away on their own.
 */
export function DismissibleBanner({
  tone,
  message,
  timeout = 6000,
}: {
  tone: "success" | "error";
  message: string;
  timeout?: number;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), timeout);
    return () => clearTimeout(t);
  }, [timeout]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "border-b px-4 py-2.5 text-sm sm:px-6 lg:px-8",
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
      )}
    >
      {message}
    </div>
  );
}
