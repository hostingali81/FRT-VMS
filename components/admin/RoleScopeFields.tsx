"use client";

import { useState } from "react";
import { Label, Select } from "@/components/ui/form";
import { ROLE_LABELS, USER_ROLES } from "@/lib/types";
import type { Division, LookupData, UserRole } from "@/lib/types";

/**
 * Role-driven location scope fields shared by the create and edit user forms.
 * Only the scope relevant to the selected role is shown:
 *   super_admin      -> none (full access)
 *   zonal_manager    -> Zone
 *   circle_incharge  -> Circle
 *   division_incharge-> Division (parent circle/zone derived automatically)
 *   viewer           -> Circle
 * Hidden inputs carry derived parent ids so a division user still has its
 * circle/zone populated (needed for lookup filtering in the rest of the app).
 */
export function RoleScopeFields({
  lookups,
  defaultRole = "viewer",
  defaultZoneId = "",
  defaultCircleId = "",
  defaultDivisionId = "",
}: {
  lookups: LookupData;
  defaultRole?: UserRole;
  defaultZoneId?: string;
  defaultCircleId?: string;
  defaultDivisionId?: string;
}) {
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [zoneId, setZoneId] = useState(defaultZoneId);
  const [circleId, setCircleId] = useState(defaultCircleId);
  const [divisionId, setDivisionId] = useState(defaultDivisionId);

  const selectedDivision = lookups.divisions.find((d) => d.id === divisionId);
  const circleFromDivision = selectedDivision?.circle_id ?? "";
  const effectiveCircleId = role === "division_incharge" ? circleFromDivision : circleId;
  const derivedZoneId = lookups.circles.find((c) => c.id === effectiveCircleId)?.zone_id ?? "";

  return (
    <>
      <Field label="Role">
        <Select name="role" value={role} onChange={(event) => setRole(event.target.value as UserRole)} required>
          {USER_ROLES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>

      {role === "super_admin" ? (
        <Field label="Access">
          <p className="flex h-10 items-center text-sm text-slate-500">Full access — no location scope.</p>
        </Field>
      ) : null}

      {role === "zonal_manager" ? (
        <Field label="Zone">
          <Select name="zone_id" value={zoneId} onChange={(event) => setZoneId(event.target.value)} required>
            <option value="">Select zone</option>
            {(lookups.zones ?? []).map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {role === "circle_incharge" || role === "viewer" ? (
        <Field label="Circle">
          <Select name="circle_id" value={circleId} onChange={(event) => setCircleId(event.target.value)} required>
            <option value="">Select circle</option>
            {lookups.circles.map((circle) => (
              <option key={circle.id} value={circle.id}>
                {circle.name}
              </option>
            ))}
          </Select>
          {derivedZoneId ? <input type="hidden" name="zone_id" value={derivedZoneId} /> : null}
        </Field>
      ) : null}

      {role === "division_incharge" ? (
        <Field label="Division">
          <Select name="division_id" value={divisionId} onChange={(event) => setDivisionId(event.target.value)} required>
            <option value="">Select division</option>
            {lookups.divisions.map((division) => (
              <option key={division.id} value={division.id}>
                {divisionLabel(division, lookups)}
              </option>
            ))}
          </Select>
          {circleFromDivision ? <input type="hidden" name="circle_id" value={circleFromDivision} /> : null}
          {derivedZoneId ? <input type="hidden" name="zone_id" value={derivedZoneId} /> : null}
        </Field>
      ) : null}
    </>
  );
}

function divisionLabel(division: Division, lookups: LookupData) {
  if (lookups.circles.length <= 1) return division.name;
  const circle = lookups.circles.find((c) => c.id === division.circle_id);
  return circle ? `${circle.name} — ${division.name}` : division.name;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
