// Shared shape + pure helpers for the /fuel-log/add "Recent Entries" filters.
//
// Deliberately NOT in components/fuel/FuelLogFilters.tsx: that file is a
// "use client" module, and Next.js turns every export of one into a client
// reference. The server component that renders the page has to build the same
// query string, and calling a client reference on the server throws at request
// time — a failure neither `tsc` nor `next build` reports, because the page is
// force-dynamic and so is never rendered during the build.
//
// Keeping the helpers in a plain module lets both sides import the real thing.

/** Every filter the Recent Entries table understands. Empty string = not applied. */
export type FuelLogFilterValues = {
  q: string;
  by: string;
  div: string;
  sub: string;
  type: string;
  from: string;
  to: string;
};

export type FuelLogFilterOptions = {
  /** Distinct `recorded_by` names on the entries this user can see. */
  people: string[];
  divisions: { id: string; name: string }[];
  substations: { id: string; name: string; divisionId: string | null }[];
  fuelTypes: string[];
};

export const EMPTY_FUEL_LOG_FILTERS: FuelLogFilterValues = {
  q: "",
  by: "",
  div: "",
  sub: "",
  type: "",
  from: "",
  to: "",
};

/** Serialise for a URL — drops blanks so a cleared filter leaves no trace. */
export function fuelLogFilterQuery(values: FuelLogFilterValues): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function countActiveFuelLogFilters(values: FuelLogFilterValues): number {
  return Object.values(values).filter(Boolean).length;
}
