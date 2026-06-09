"use client";

import { useState } from "react";
import { Label, Select } from "@/components/ui/form";
import { ROLE_LABELS, USER_ROLES } from "@/lib/types";
import type { LookupData, UserRole } from "@/lib/types";

type ViewerScope = "zone" | "circle" | "division";

/**
 * Role-driven location scope fields shared by the create and edit user forms.
 * Only the scope relevant to the selected role is shown:
 *   super_admin      -> none (full access)
 *   zonal_manager    -> none (organization-wide "Admin", no location scope)
 *   circle_incharge  -> Circle
 *   division_incharge-> Circle, then Division (filtered to that circle)
 *   viewer           -> choose any one level: Zone, Circle, or Division
 *
 * For a division user the parent circle/zone are submitted too so lookups in
 * the rest of the app resolve correctly. A viewer is scoped to exactly one
 * level, so only that id is submitted.
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
  const circleOfDefaultDivision = lookups.divisions.find((d) => d.id === defaultDivisionId)?.circle_id ?? "";

  const [role, setRole] = useState<UserRole>(defaultRole);
  const [zoneId, setZoneId] = useState(defaultZoneId);
  const [circleId, setCircleId] = useState(defaultCircleId || circleOfDefaultDivision);
  const [divisionId, setDivisionId] = useState(defaultDivisionId);
  const [viewerScope, setViewerScope] = useState<ViewerScope>(
    defaultDivisionId ? "division" : defaultZoneId ? "zone" : "circle",
  );

  const divisionsForCircle = lookups.divisions.filter((d) => d.circle_id === circleId);
  const derivedZoneId = lookups.circles.find((c) => c.id === circleId)?.zone_id ?? "";

  function pickCircle(value: string) {
    setCircleId(value);
    setDivisionId("");
  }

  const circleSelect = (name: string | undefined, label = "Circle") => (
    <Field label={label}>
      <Select name={name} value={circleId} onChange={(event) => pickCircle(event.target.value)} required>
        <option value="">Select circle</option>
        {lookups.circles.map((circle) => (
          <option key={circle.id} value={circle.id}>
            {circle.name}
          </option>
        ))}
      </Select>
    </Field>
  );

  const divisionSelect = (
    <Field label="Division">
      <Select
        name="division_id"
        value={divisionId}
        onChange={(event) => setDivisionId(event.target.value)}
        disabled={!circleId}
        required
      >
        <option value="">{circleId ? "Select division" : "Select circle first"}</option>
        {divisionsForCircle.map((division) => (
          <option key={division.id} value={division.id}>
            {division.name}
          </option>
        ))}
      </Select>
    </Field>
  );

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

      {role === "super_admin" || role === "zonal_manager" ? (
        <Field label="Access">
          <p className="flex h-10 items-center text-sm text-slate-500">Full access — no location scope.</p>
        </Field>
      ) : null}

      {role === "circle_incharge" ? (
        <>
          {circleSelect("circle_id")}
          {derivedZoneId ? <input type="hidden" name="zone_id" value={derivedZoneId} /> : null}
        </>
      ) : null}

      {role === "division_incharge" ? (
        <>
          {circleSelect("circle_id")}
          {divisionSelect}
          {derivedZoneId ? <input type="hidden" name="zone_id" value={derivedZoneId} /> : null}
        </>
      ) : null}

      {role === "viewer" ? (
        <>
          <Field label="Scope">
            <Select value={viewerScope} onChange={(event) => setViewerScope(event.target.value as ViewerScope)}>
              <option value="zone">Whole Zone</option>
              <option value="circle">A Circle</option>
              <option value="division">A Division</option>
            </Select>
          </Field>
          {viewerScope === "zone" ? <ZoneField zoneId={zoneId} setZoneId={setZoneId} lookups={lookups} /> : null}
          {viewerScope === "circle" ? circleSelect("circle_id") : null}
          {viewerScope === "division" ? (
            <>
              {/* Nameless: only used to filter the division list, not persisted. */}
              {circleSelect(undefined, "Circle (filter)")}
              {divisionSelect}
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function ZoneField({
  zoneId,
  setZoneId,
  lookups,
}: {
  zoneId: string;
  setZoneId: (value: string) => void;
  lookups: LookupData;
}) {
  return (
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
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
