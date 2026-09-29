"use client";

import { useState } from "react";
import { Label, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils/cn";
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
 *
 * On top of that one scope, every location-scoped role can be granted extra
 * divisions. That is how the QRT van — parked in a division of its own, so
 * invisible to every division user — gets an owner: tick QRT for whoever fuels
 * and runs it.
 */
export function RoleScopeFields({
  lookups,
  defaultRole = "viewer",
  defaultZoneId = "",
  defaultCircleId = "",
  defaultDivisionId = "",
  defaultExtraDivisionIds = [],
}: {
  lookups: LookupData;
  defaultRole?: UserRole;
  defaultZoneId?: string;
  defaultCircleId?: string;
  defaultDivisionId?: string;
  defaultExtraDivisionIds?: string[];
}) {
  const circleOfDefaultDivision = lookups.divisions.find((d) => d.id === defaultDivisionId)?.circle_id ?? "";

  const [role, setRole] = useState<UserRole>(defaultRole);
  const [zoneId, setZoneId] = useState(defaultZoneId);
  const [circleId, setCircleId] = useState(defaultCircleId || circleOfDefaultDivision);
  const [divisionId, setDivisionId] = useState(defaultDivisionId);
  const [viewerScope, setViewerScope] = useState<ViewerScope>(
    defaultDivisionId ? "division" : defaultZoneId ? "zone" : "circle",
  );

  const [extraDivisionIds, setExtraDivisionIds] = useState<string[]>(defaultExtraDivisionIds);

  const divisionsForCircle = lookups.divisions.filter((d) => d.circle_id === circleId);
  const derivedZoneId = lookups.circles.find((c) => c.id === circleId)?.zone_id ?? "";

  // Grants only make sense for a role that has a location scope to extend.
  const canGrantDivisions = role === "circle_incharge" || role === "division_incharge" || role === "viewer";

  function toggleExtraDivision(id: string) {
    setExtraDivisionIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

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

      {canGrantDivisions ? (
        <ExtraDivisionAccess
          lookups={lookups}
          ownDivisionId={role === "circle_incharge" ? "" : divisionId}
          selected={extraDivisionIds}
          onToggle={toggleExtraDivision}
        />
      ) : null}
    </>
  );
}

/**
 * Extra divisions on top of the user's own scope. Submitted as repeated
 * `extra_division_ids` fields, which the action reads with `getAll`.
 *
 * Checkboxes rather than a multi-select: the list is short, and the whole point
 * is that the super admin can see at a glance who currently holds QRT.
 */
function ExtraDivisionAccess({
  lookups,
  ownDivisionId,
  selected,
  onToggle,
}: {
  lookups: LookupData;
  ownDivisionId: string;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const showCircle = lookups.circles.length > 1;
  const options = lookups.divisions.filter((division) => division.id !== ownDivisionId);

  return (
    <div className="space-y-2 md:col-span-2 xl:col-span-4">
      <Label>Extra Division Access</Label>
      <p className="text-xs text-slate-500">
        Divisions this user can also see and manage, on top of their own scope. Tick QRT to put someone in charge of
        the QRT van — they can then log its fuel like any vehicle of their own division.
      </p>
      {options.length === 0 ? (
        <p className="text-sm italic text-slate-400">No other divisions to grant.</p>
      ) : (
        <div className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-white p-3">
          {options.map((division) => {
            const checked = selected.includes(division.id);
            return (
              <label
                key={division.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm",
                  checked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700",
                )}
              >
                <input
                  type="checkbox"
                  name="extra_division_ids"
                  value={division.id}
                  checked={checked}
                  onChange={() => onToggle(division.id)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
                {division.name}
                {showCircle ? (
                  <span className={checked ? "text-slate-300" : "text-slate-400"}>
                    {lookups.circles.find((circle) => circle.id === division.circle_id)?.name ?? ""}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      )}
    </div>
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
