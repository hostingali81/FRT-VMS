"use client";

import { ChevronDown, ChevronUp, Filter, RotateCcw, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import {
  EMPTY_FUEL_LOG_FILTERS,
  countActiveFuelLogFilters,
  fuelLogFilterQuery,
  type FuelLogFilterOptions,
  type FuelLogFilterValues,
} from "@/lib/fuel-log-filters";

/**
 * Filters for the Recent Entries table on /fuel-log/add.
 *
 * URL-driven, not local state: the table is paginated on the server, so a
 * client-side filter would only ever narrow the 25 rows of the current page
 * instead of searching every entry. Pushing the filters into the query string
 * lets the server filter first and paginate the result, and makes a filtered
 * view shareable and survivable across the back button.
 *
 * The selects apply on change; the text box applies on submit so a round trip
 * doesn't fire on every keystroke. Any change resets to page 1 — the page the
 * user was on rarely exists in the new, smaller result set.
 */
export function FuelLogFilters({
  values,
  options,
}: {
  values: FuelLogFilterValues;
  options: FuelLogFilterOptions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(values.q);
  const activeCount = countActiveFuelLogFilters(values);
  // Open when something is already filtered. The parent table remounts on every
  // navigation (it is keyed on its rows), so a plain `false` would snap the panel
  // shut after each pick and make setting two filters in a row impossible.
  const [open, setOpen] = useState(activeCount > 0);

  // Substations narrow to the chosen division, the same way the vehicle and
  // driver forms cascade their location selects.
  const substations = useMemo(
    () => (values.div ? options.substations.filter((s) => s.divisionId === values.div) : options.substations),
    [options.substations, values.div],
  );

  function apply(patch: Partial<FuelLogFilterValues>) {
    // Whatever is typed in the search box rides along with every apply. Without
    // it, clicking a select right after typing would race: the input's blur and
    // the select's change both build a URL from the same stale `values`, and
    // whichever landed second would silently drop the other's change.
    const next = { ...values, q: search.trim(), ...patch };
    const query = fuelLogFilterQuery(next);
    // No `page` in the pushed URL → back to page 1. scroll:false keeps the table
    // in view instead of jumping to the add form at the top of the page.
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function clearAll() {
    setSearch("");
    apply(EMPTY_FUEL_LOG_FILTERS);
  }

  const selects = (
    <>
      <Field label="Entry By">
        <Select value={values.by} onChange={(e) => apply({ by: e.target.value })} aria-label="Entry by">
          <option value="">Everyone</option>
          {options.people.map((person) => (
            <option key={person} value={person}>
              {person}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Division">
        <Select
          value={values.div}
          // Changing division can orphan the chosen substation, so clear it.
          onChange={(e) => apply({ div: e.target.value, sub: "" })}
          aria-label="Division"
        >
          <option value="">All divisions</option>
          {options.divisions.map((division) => (
            <option key={division.id} value={division.id}>
              {division.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Substation">
        <Select value={values.sub} onChange={(e) => apply({ sub: e.target.value })} aria-label="Substation">
          <option value="">All substations</option>
          {substations.map((substation) => (
            <option key={substation.id} value={substation.id}>
              {substation.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Fuel Type">
        <Select value={values.type} onChange={(e) => apply({ type: e.target.value })} aria-label="Fuel type">
          <option value="">All fuels</option>
          {options.fuelTypes.map((fuelType) => (
            <option key={fuelType} value={fuelType}>
              {fuelType}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="From Date">
        <Input
          type="date"
          value={values.from}
          max={values.to || undefined}
          onChange={(e) => apply({ from: e.target.value })}
          aria-label="From date"
        />
      </Field>
      <Field label="To Date">
        <Input
          type="date"
          value={values.to}
          min={values.from || undefined}
          onChange={(e) => apply({ to: e.target.value })}
          aria-label="To date"
        />
      </Field>
    </>
  );

  const searchBox = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        apply({ q: search.trim() });
      }}
      className="relative"
    >
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <Input
        type="search"
        placeholder="Search by registration or FRT no…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        // A cleared search box should clear the filter without needing Enter.
        onBlur={() => search.trim() !== values.q && apply({ q: search.trim() })}
        className="pl-9"
        aria-label="Search entries by registration or FRT number"
      />
    </form>
  );

  return (
    <div className="border-b border-slate-200 bg-white p-3 sm:p-4">
      {/* ── Desktop (md+): search on top, every filter always visible ── */}
      <div className="hidden md:block">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex-1">{searchBox}</div>
          {activeCount > 0 && <ClearButton onClick={clearAll} />}
        </div>
        <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">{selects}</div>
      </div>

      {/* ── Mobile (< md): search always visible, filters behind a toggle ── */}
      <div className="md:hidden">
        <div className="mb-2">{searchBox}</div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filters
            {activeCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {activeCount}
              </span>
            )}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
          )}
        </button>
        {open && (
          <div className="mt-2 flex flex-col gap-3">
            {selects}
            {activeCount > 0 && <ClearButton onClick={clearAll} className="w-full" />}
          </div>
        )}
      </div>
    </div>
  );
}

function ClearButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button type="button" variant="outline" onClick={onClick} className={className}>
      <RotateCcw className="h-4 w-4" aria-hidden="true" />
      Clear
    </Button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </div>
  );
}
