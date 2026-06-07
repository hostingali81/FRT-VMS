"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
      <div className="rounded-full bg-red-100 p-3">
        <AlertCircle className="h-10 w-10 text-red-600" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-slate-900">Something went wrong!</h2>
      <p className="mt-2 text-sm text-slate-500 max-w-md">
        {error.message || "An unexpected error occurred. Please try again or contact support."}
      </p>
      <Button onClick={() => reset()} className="mt-6">
        <RotateCcw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
