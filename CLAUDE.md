# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (also type-checks)
npm run lint         # ESLint via next lint
npx tsc --noEmit     # Type-check without building
```

No test suite exists. Verification is `npm run lint && npm run build`.

**Supabase migrations** (when schema changes are needed):
```bash
npx supabase login
npx supabase link --project-ref basfgceiklbzcjdfbmij --password YOUR_DB_PASSWORD
npx supabase db push
```

The app runs without Supabase keys — all data functions fall back to `lib/mock-data.ts` when `createSupabaseAdminClient()` returns `null`.

---

## Architecture

### Next.js App Router — Server-first

All pages are async Server Components with `export const dynamic = "force-dynamic"`. Data is fetched at the top of each page and passed down as props. No client-side data fetching (SWR/React Query are installed but unused for primary data).

Mutations use **Next.js Server Actions** (`"use server"` in `lib/actions/`). After every mutation, actions call `revalidatePath()` on affected routes and then `redirect()`.

### Data layer — `lib/data.ts`

All Supabase reads go through this file. The key functions are wrapped with `React.cache()` so they deduplicate within a single server request:

- `getAllLookups()` — zones/circles/divisions/substations (no args, always cached per request)
- `getVehicles(profile)` — full vehicle list, permission-filtered
- `getTransfers(profile)` — transfer history, permission-filtered  
- `getAllStatusHistory(profile)` — status history, permission-filtered

Functions that call `getVehicles()` internally (e.g., `getCircleSummaries`, `getDivisionSummaries`, `getDrivers`) benefit from this cache automatically, provided they receive the same `profile` reference. **Do not remove the `cache()` wrappers.**

Auth functions `getSessionUser` and `getCurrentProfile` in `lib/auth.ts` are also `cache()`-wrapped to avoid redundant Supabase auth calls per request.

### Permission model — `lib/permissions.ts`

Role hierarchy: `super_admin > zonal_manager > circle_incharge > division_incharge > viewer`

Permission checks are purely in application code (no Supabase RLS filtering). Every Server Action calls `requireProfile()` then checks permissions before touching the database. The key permission functions are `canSeeVehicle`, `canEditVehicle`, `canTransferVehicle`, `canAccessLocation`.

On top of the role's own scope, a user can hold **extra division grants** (`user_division_access`). `getCurrentProfile()` loads them onto the profile as `extra_division_ids`, and `accessibleDivisionIds()` unions them in — so the checks stay synchronous. This is what lets the super admin give a division user the QRT division (Admin → user → Extra Division Access): QRT is a division holding one van, so without a grant nobody below circle level can see it or log its fuel.

### Supabase schema patterns

- `vehicles` table + `vehicle_assignments` (1:1, current location) + append-only history tables
- History tables (`vehicle_transfer_history`, `vehicle_status_history`, `driver_assignments`) have a DB trigger that blocks DELETE — they are permanent records
- Complex mutations (transfer, status change, driver replace) go through **Supabase RPC functions** (`transfer_vehicle`, `change_vehicle_status`, `replace_driver_assignment`) defined in `002_views_and_functions.sql`. These handle the atomic write + history + audit log in a single DB transaction
- Read queries use **views** (`vehicle_current_view`, `transfer_history_view`, `driver_current_view`, etc.) that join base tables

When adding a new tracked field that needs history, follow the `vehicle_status_history` pattern: a separate append-only table with `from_date`/`to_date` and a Supabase RPC for atomic updates.

### `AppShell` and profile passing

`AppShell` accepts an optional `profile` prop. Pages always pass their already-fetched profile: `<AppShell profile={profile}>`. If omitted, AppShell calls `requireProfile()` itself — avoid this as it wastes a DB round-trip.

### Forms and mutations

All interactive forms are `"use client"` components that receive a Server Action as an `action` prop. Submit buttons use `<SubmitButton>` from `components/ui/submit-button.tsx` (not the plain `<Button>`) — this component uses `useFormStatus()` to auto-disable and show a spinner during submission. Use `<SubmitButton>` for all `type="submit"` buttons inside `<form action={serverAction}>`.

Validation: Server Actions parse `FormData` with a Zod schema (from `lib/validations.ts`). On failure they `redirect()` back with `?error=` in the query string. On success they `redirect()` forward. Those query params are surfaced by the global `ToastProvider` in `app/layout.tsx` — pages do not render their own banners for them, so a new result code needs a message added there, and a Zod message must read like something a user can act on ("Select the substation…", not Zod's default "Invalid input").

`Select` (`components/ui/searchable-select.tsx`) is a custom combobox, not a native `<select>`. It mirrors its value into a transparent, click-through native `<select>` laid over the trigger — a hidden input is barred from constraint validation, so `required` would do nothing and incomplete forms would post and bounce back silently. Keep the mirror focusable: `display:none`/zero-size makes Chrome refuse to report the control and the form fails to submit with no message at all.

### Types

All shared types live in `lib/types.ts`. Enum-like values use `as const` arrays (`VEHICLE_STATUSES`, `DRIVER_SHIFTS`, `USER_ROLES`) so both the type and the runtime array are derived from one source.

### UI conventions

- Custom UI primitives in `components/ui/` (Button, Card, Badge, Input, Select, etc.) — use these, don't introduce a component library
- `components/shared/` holds cross-cutting components (PageHeader, Timeline, StatusBadge, ExpiryBadge)
- Tailwind only; no CSS modules or styled-components
- `cn()` utility from `lib/utils/cn.ts` for conditional class merging
