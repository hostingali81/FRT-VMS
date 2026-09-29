"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";

// Success params must be the exact sentinel "=1" set by the Server Actions.
// Numeric counts from result banners (e.g. the RTO refresh's rtoUpdated=0)
// must never fire a success toast, so plain truthiness is not enough.
const SUCCESS_MESSAGES: Record<string, string> = {
  vcreated: "Vehicle created successfully",
  updated: "Vehicle updated successfully",
  created: "Driver created successfully",
  transferred: "Vehicle transferred successfully",
  status: "Status updated successfully",
  driver: "Driver assigned successfully",
  driverby: "Driver source updated successfully",
  fuel: "Fuel ownership updated successfully",
  // Fuel log add/edit/delete from a vehicle's Fuel Logs tab. The /fuel-log/add
  // page has its own inline banners (?added / ?updated / ?deleted carry a
  // registration, not "1"), but the in-profile flows redirected back with no
  // feedback at all until these were listed here.
  fuellog: "Fuel entry saved successfully",
  fuelupdated: "Fuel entry updated successfully",
  fueldeleted: "Fuel entry deleted",
};

// Friendly messages for the machine-readable error codes used in redirects.
// Unknown values are full human-readable messages (e.g. Zod validation text)
// and are shown as-is.
const ERROR_MESSAGES: Record<string, string> = {
  permission: "You don't have permission to do that",
  profile: "Your account has no active profile — contact the administrator",
  server: "Server connection failed — please try again",
  "scope-required": "Select the circle/division required for this role",
  "user-required": "Email, password, name and role are all required",
  "password-too-short": "Password must be at least 6 characters",
  "invalid-role": "The selected role is not valid",
  "user-create": "Could not create the user — the email may already exist",
  "profile-create": "User was created but profile setup failed — contact the administrator",
  "user-update": "Could not update the user",
  "zone-required": "Zone name is required",
  "zone-create": "Could not create the zone",
  "circle-required": "Circle name is required",
  "circle-create": "Could not create the circle",
  "division-required": "Division name and circle are required",
  "division-create": "Could not create the division",
  "substation-required": "Substation name and division are required",
  "substation-create": "Could not create the substation",
  "substation-update": "Could not update the substation",
  "division-access": "The user was saved, but their extra division access could not be stored",
  "name-required": "Name is required",
  "name-update": "Could not update your name",
  "password-required": "Enter your current and new password",
  "password-mismatch": "New passwords do not match",
  "password-wrong": "Current password is incorrect",
  "password-update": "Could not change your password",
};

export function ToastProvider() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      const decoded = decodeURIComponent(error);
      toast.error(ERROR_MESSAGES[decoded] ?? decoded);
    }

    for (const [param, message] of Object.entries(SUCCESS_MESSAGES)) {
      if (searchParams.get(param) === "1") toast.success(message);
    }

    const user = searchParams.get("user");
    if (user === "created") toast.success("User created successfully");
    if (user === "updated") toast.success("User updated successfully");

    const profile = searchParams.get("profile");
    if (profile === "name-updated") toast.success("Name updated successfully");
    if (profile === "password-updated") toast.success("Password changed successfully");
    if (searchParams.get("zone") === "created") toast.success("Zone created successfully");
    if (searchParams.get("circle") === "created") toast.success("Circle created successfully");
    if (searchParams.get("division") === "created") toast.success("Division created successfully");
    const substation = searchParams.get("substation");
    if (substation === "created") toast.success("Substation created successfully");
    if (substation === "updated") toast.success("Substation updated successfully");
  }, [searchParams]);

  return <Toaster position="top-right" richColors />;
}
