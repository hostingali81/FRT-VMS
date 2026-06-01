"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";

export function ToastProvider() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    const updated = searchParams.get("updated");
    const created = searchParams.get("created");
    const transferred = searchParams.get("transferred");
    const status = searchParams.get("status");
    const driver = searchParams.get("driver");

    if (error) toast.error(decodeURIComponent(error));
    if (updated) toast.success("Updated successfully");
    if (created) toast.success("Created successfully");
    if (transferred) toast.success("Vehicle transferred successfully");
    if (status) toast.success("Status updated successfully");
    if (driver) toast.success("Driver assigned successfully");

    // Clear params from URL without reload would be better, but for now this works
  }, [searchParams]);

  return <Toaster position="top-right" richColors />;
}
