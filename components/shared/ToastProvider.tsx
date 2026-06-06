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
    const fuel = searchParams.get("fuel");
    const user = searchParams.get("user");
    const zone = searchParams.get("zone");
    const circle = searchParams.get("circle");
    const division = searchParams.get("division");
    const substation = searchParams.get("substation");

    if (error) toast.error(decodeURIComponent(error));
    if (updated) toast.success("Updated successfully");
    if (created) toast.success("Created successfully");
    if (transferred) toast.success("Vehicle transferred successfully");
    if (status) toast.success("Status updated successfully");
    if (driver) toast.success("Driver assigned successfully");
    if (fuel) toast.success("Fuel ownership updated successfully");
    if (user === "created") toast.success("User created successfully");
    if (user === "updated") toast.success("User updated successfully");
    if (zone === "created") toast.success("Zone created successfully");
    if (circle === "created") toast.success("Circle created successfully");
    if (division === "created") toast.success("Division created successfully");
    if (substation === "created") toast.success("Substation created successfully");
  }, [searchParams]);

  return <Toaster position="top-right" richColors />;
}
