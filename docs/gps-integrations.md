# GPS Integrations — How FRT-VMS Pulls Distance Data

This document explains, end to end, how the app fetches data from the **two GPS
tracking providers** it integrates with. It's written for a developer who has
never touched this code before — every moving part is spelled out.

The two providers are:

| Provider | `gps_company` value in DB | Base URL | Distance unit returned |
|----------|---------------------------|----------|------------------------|
| **Millitrack** (VehicleStep app) | `VehicleStep` | `http://track4.millitrack.com` (HTTP, no SSL) | **meters** |
| **WheelsEye** | `WheelsEye` | `https://wheelseye.com` | **kilometers** |

> **One sentence summary:** each vehicle row has a `gps_company` and a
> `gps_device_id`; a sync job looks at `gps_company` to decide which provider's API
> to call, fetches the distance the vehicle travelled in a month, and upserts it
> into the `vehicle_gps_distance` table.

---

## 1. The big picture

```
                       ┌─────────────────────────────────────────────┐
                       │  Trigger                                     │
                       │   • /fuel  "Sync GPS Data" button (manual)   │
                       │   • Vercel Cron (daily)  GET /api/cron/...   │
                       └───────────────────┬─────────────────────────┘
                                           │ calls
                                           ▼
                          lib/gps-distance.ts  →  syncMonthlyGpsDistance()
                                           │
              reads `vehicles` (id, registration_no, gps_device_id, gps_company)
                                           │
                 ┌─────────────────────────┴──────────────────────────┐
                 │ split by gps_company                                │
                 ▼                                                     ▼
   gps_company === "VehicleStep"                        gps_company === "WheelsEye"
        lib/millitrack.ts                                    lib/wheelseye.ts
   one summary call PER vehicle                       one report call for ALL vehicles
   match by numeric gps_device_id                     match by registration number
                 │                                                     │
                 └─────────────────────────┬──────────────────────────┘
                                           ▼
                          upsert into  vehicle_gps_distance
                          (vehicle_id, year_month, distance_km, synced_at)
                                           │
                                           ▼
                       Shown in UI: /fuel dashboard, vehicle profile
                       "GPS Distance" tab, fuel "Avg km/L" column
```

There are actually **two distinct sync flows** (don't confuse them):

1. **Monthly distance sync** — provider-aware (both Millitrack + WheelsEye).
   Writes month-wise totals to `vehicle_gps_distance`. This is the main one and
   what this doc focuses on. Files: [`lib/gps-distance.ts`](../lib/gps-distance.ts),
   triggered by [`lib/actions/gps-actions.ts`](../lib/actions/gps-actions.ts) →
   `syncGpsMonthlyDistanceAction` and by the cron route
   [`app/api/cron/gps-distance/route.ts`](../app/api/cron/gps-distance/route.ts).

2. **Per-fuel-segment sync** — **Millitrack only**. For each company vehicle it
   computes the distance between two consecutive fuel fill-ups and stores it on
   `vehicle_fuel_logs.gps_distance_km`, which drives the per-fill "Avg km/L".
   File: `syncGpsDistanceAction` in [`lib/actions/gps-actions.ts`](../lib/actions/gps-actions.ts).
   (WheelsEye is not wired into this flow.)

Both flows ultimately call the same two provider clients described below.

---

## 2. Provider A — Millitrack (VehicleStep)

File: [`lib/millitrack.ts`](../lib/millitrack.ts)

Millitrack is a Traccar-based GPS platform. We talk to the **Android app's
internal backend** (`track4.millitrack.com`), *not* the old web dashboard
(`mvts4.millitrack.com`). The Android backend authenticates with a **JWT** sent
in an `x-auth-token` header.

### 2.1 Authentication (fully automatic)

You never set a token by hand. The flow:

```
POST http://track4.millitrack.com/api/session?app=in.vehiclestep.vehiclesteppro.gpstracker&dc=<timestamp>
Content-Type: application/x-www-form-urlencoded
Body: username=<MT_USERNAME>&password=<MT_PASSWORD>

→ 200 { "token": "<JWT>", ... }
```

- The JWT comes back **in the JSON body** as `token` (not in a header/cookie).
- It is cached in a module-level variable (`cachedToken`) and reused for every
  later call within a warm server instance.
- The JWT has **no `exp` claim** → it's long-lived, so there's no time-based
  refresh. We only re-login when the server actually rejects the token.

Relevant functions:

- `isMillitrackConfigured()` — true if `MT_TOKEN` is set, OR both
  `MT_USERNAME`(/`MT_EMAIL`) and `MT_PASSWORD` are set.
- `millitrackLogin()` — does the POST above, returns the JWT.
- `getToken(forceRefresh)` — resolution order: **fixed `MT_TOKEN` override →
  cached token → fresh login**.
- `authedFetch(path)` — attaches `x-auth-token`, and **on a 401/403 it clears the
  cache, re-logs in once, and retries** (unless a fixed `MT_TOKEN` is in use,
  which we can't refresh).

> ⚠️ **`username` is the account username** (e.g. `imperial.barabanki`), which may
> be different from the email the web dashboard used.

### 2.2 Endpoints we call

| Function | HTTP | Purpose |
|----------|------|---------|
| `getDevices()` | `GET /api/devices` | List every GPS device on the account (`id`, `name`, `uniqueId`, `status`). |
| `millitrackSummary(deviceId, fromISO, toISO)` | `GET /api/reports/summary?...` | Distance summary for **one** device over a date range. |

The summary query string (built in `millitrackSummary`):

```
/api/reports/summary
  ?from=<ISO>&to=<ISO>
  &mail=false
  &deviceId=<numericId>
  &startHour=0&startMinute=0&endHour=0&endMinute=0   # 0 = whole day, no time-of-day filter
  &useTimeAsInterval=false
  &dc=<timestamp>                                     # cache buster
```

### 2.3 The critical gotcha — `daily=true` is ignored

In stock Traccar you can ask for a per-day breakdown. **track4 ignores this** —
it always returns **ONE aggregate row** for the entire `[from, to]` window
(this was verified live). Consequences:

- You **cannot** get a day-by-day breakdown from a single call.
- To get distance per period (e.g. per month, or per fuel segment), you call
  `millitrackSummary()` **once per period** with that period's exact date range.

### 2.4 Units & field normalization

- `distance` is in **meters** → the caller divides by 1000 for km.
- The Android API uses some richer field names; `normalizeSummary()` maps them
  onto the classic Traccar names the app expects:
  - `distanceTravelled` → `distance`
  - `mileageFuelConsumed` → `spentFuel`
  - `firstIgnitionOnTime` / `lastIgnitionOffTime` → `startTime` / `endTime`

### 2.5 Device mapping

A Millitrack vehicle is matched by its **numeric device id** stored in
`vehicles.gps_device_id` (e.g. `229016`). The sync only picks Millitrack vehicles
whose `gps_device_id` is all digits (`/^\d+$/`). You map devices **manually** by
entering the numeric Traccar id into the vehicle's GPS Device ID field.

---

## 3. Provider B — WheelsEye

File: [`lib/wheelseye.ts`](../lib/wheelseye.ts)

WheelsEye is a separate Indian fleet-tracking platform with a completely
different API shape. The big structural difference: **one report call returns
distance for ALL vehicles at once**, and vehicles are matched by **registration
number**, not by a device id.

### 3.1 Authentication

```
POST https://wheelseye.com/shield/admin/v3/login
Content-Type: application/json
Body: { "userName": "<WHEELSEYE_LOGIN>", "password": "<WHEELSEYE_PASSWORD>" }

→ 200 { "success": true, "data": { "accessToken": "<UUID>" } }
```

- The token is a **UUID** in `data.accessToken`.
- It is sent on later calls in a **`token` header** (plain, not `Bearer`).
- Same caching + re-login-on-401/403 pattern as Millitrack.
- Every request also sends fixed identity headers:
  `source: OPERATOR_WEB`, `x-app-version: 18.4.0`.

`isWheelsEyeConfigured()` is true when both `WHEELSEYE_LOGIN` and
`WHEELSEYE_PASSWORD` are set.

### 3.2 Endpoints we call

| Function | HTTP | Purpose |
|----------|------|---------|
| `getVehicleList(token)` | `GET /vehicle/getAll` | All vehicles on the account → `[{ name: vNo, value: vId }]`. We need the internal `vId` to request a report. |
| `wheelsEyeDistanceByReg(fromSec, toSec)` | `POST /rest/argus/reports/generate/v2` | A "distance" report for **all** vehicles over a Unix-seconds range. |

The report request body (built in `wheelsEyeDistanceByReg`):

```json
{
  "reportType": "distance",
  "filters": [
    { "code": "vehicles",    "options": [ { "name": "<vNo>", "value": <vId>, "isSelected": true }, ... ] },
    { "code": "reportTime",  "options": [ { "name": "Date Range", "value": "CUSTOM",
                                            "metadata": { "custom": true, "dateRange": { "from": <fromSec>, "to": <toSec> } } } ] },
    { "code": "report_type", "options": [ { "name": "Distance", "value": "distance", "isSelected": true } ] }
  ]
}
```

### 3.3 Parsing the response

The report comes back as a 2-D array under `data.reportContent.data`, where each
row is:

```
[ vehicleNo, fromDate, toDate, distanceKM, timeTaken, hasDevice ]
       r[0]                        r[3]
```

We build a `Map<normalizedRegistration, km>`:

```ts
map.set(normReg(String(r[0])), parseFloat(String(r[3])) || 0);
```

- `distanceKM` (`r[3]`) is **already in kilometers** — no /1000 needed.
- `normReg()` upper-cases and strips everything non-alphanumeric, so
  `"UP 41 CT 6926"` and `"up41ct6926"` both become `UP41CT6926`. This is how a
  WheelsEye row is matched back to a vehicle in our DB.

### 3.4 Device mapping

WheelsEye vehicles are matched by **registration number**, so the exact value of
`gps_device_id` doesn't matter for matching — **but it must still be non-null**
(see §4.1). In practice, set `gps_company = "WheelsEye"` on the vehicle and give
it any non-empty `gps_device_id`.

---

## 4. The orchestrator — `syncMonthlyGpsDistance()`

File: [`lib/gps-distance.ts`](../lib/gps-distance.ts)

This is the function both the manual button and the cron call. Step by step:

### 4.1 Load candidate vehicles

```ts
supabase.from("vehicles")
  .select("id,registration_no,gps_device_id,gps_company")
  .not("gps_device_id", "is", null);   // ← gps_device_id MUST be non-null
```

> ⚠️ **Gotcha:** even WheelsEye vehicles (matched by registration) must have a
> **non-null `gps_device_id`** to pass this filter. A vehicle with no device id is
> simply skipped by the sync.

It then splits the list:

```ts
const millitrack = all.filter(v => v.gps_company === "VehicleStep" && /^\d+$/.test(v.gps_device_id));
const wheelseye  = all.filter(v => v.gps_company === "WheelsEye");
```

`allowedVehicleIds` (optional `Set`) scopes the run: a non-admin only syncs their
own vehicles; `null`/`undefined` (cron, super_admin) syncs the whole fleet.

### 4.2 Which months to sync (IST-aware)

India is UTC+5:30. Months are treated as **IST calendar months**, so "month
start" is `00:00 IST`, computed as `Date.UTC(y, m, 1) − 5.5h`.

- Always sync the **current** month: `[month start → now]`.
- On the **1st–2nd** of a month, also re-sync the **previous** month one last
  time to finalize it (so late GPS data isn't lost). After that, past months are
  frozen.

### 4.3 Fetch + upsert per provider

**Millitrack** — one call per vehicle, per target month, in **chunks of 5**
(bounded concurrency so we don't hammer the API or blow the function timeout):

```ts
const rows = await millitrackSummary(deviceId, startISO, endISO);
const km = rows.reduce((sum, r) => sum + (r.distance ?? 0) / 1000, 0);  // meters → km
await upsert(vehicle.id, year, monthIdx, km);
```

**WheelsEye** — one report call covers **all** WheelsEye vehicles per month;
then we look up each vehicle's km by normalized registration:

```ts
const kmByReg = await wheelsEyeDistanceByReg(fromSec, toSec);
for (const v of wheelseye) {
  const km = kmByReg.get(normReg(v.registration_no));
  if (km == null) { failed++; continue; }   // vehicle not found in report
  await upsert(v.id, year, monthIdx, km);    // km already in km
}
```

The `upsert` writes to `vehicle_gps_distance` keyed on `(vehicle_id, year_month)`,
so re-running the same month overwrites that month's row instead of duplicating:

```ts
supabase.from("vehicle_gps_distance").upsert(
  { vehicle_id, year_month: "YYYY-MM", distance_km: +km.toFixed(2), synced_at: nowISO },
  { onConflict: "vehicle_id,year_month" },
);
```

### 4.4 Error handling & result

- Per-vehicle (Millitrack) and per-vehicle/per-report (WheelsEye) errors are
  caught and **counted**, never thrown — one bad vehicle doesn't fail the run.
- A WheelsEye vehicle missing from the report counts as `failed`.
- Returns `MonthlySyncResult`:

```ts
{ ok, reason?, vehicles, months, failed, from, to }
//   vehicles = distinct vehicles touched
//   months   = month-rows upserted
//   from/to  = the window the current month was measured over (shown in the UI banner)
```

---

## 5. Triggers (who calls the sync)

| Entry point | File | Provider(s) | Notes |
|-------------|------|-------------|-------|
| "Sync GPS Data" button on `/fuel` | `syncGpsMonthlyDistanceAction` in [`lib/actions/gps-actions.ts`](../lib/actions/gps-actions.ts) | Both | Open to `super_admin`/`circle_incharge`/`division_incharge`; non-admins are scoped to their editable vehicles via `allowedVehicleIds`. |
| Daily Vercel Cron | [`app/api/cron/gps-distance/route.ts`](../app/api/cron/gps-distance/route.ts) | Both | `GET` secured by `CRON_SECRET` (`Authorization: Bearer <secret>`); syncs the whole fleet. |
| Per-fuel-segment sync | `syncGpsDistanceAction` in [`lib/actions/gps-actions.ts`](../lib/actions/gps-actions.ts) | **Millitrack only** | `super_admin` only; writes `vehicle_fuel_logs.gps_distance_km` for "Avg km/L". |

---

## 6. Environment variables

| Var | Provider | Required? | Default |
|-----|----------|-----------|---------|
| `MT_USERNAME` (or `MT_EMAIL`) | Millitrack | Yes (unless `MT_TOKEN`) | — |
| `MT_PASSWORD` | Millitrack | Yes (unless `MT_TOKEN`) | — |
| `MT_TOKEN` | Millitrack | Optional | — (fixed JWT override; skips login) |
| `MT_BASE_URL` | Millitrack | Optional | `http://track4.millitrack.com` |
| `WHEELSEYE_LOGIN` | WheelsEye | Yes | — |
| `WHEELSEYE_PASSWORD` | WheelsEye | Yes | — |
| `WHEELSEYE_BASE_URL` | WheelsEye | Optional | `https://wheelseye.com` |
| `CRON_SECRET` | (cron auth) | Yes for cron | — |

> These GPS vars are **not** in `.env.local.example` yet — add them to your local
> `.env.local` and to the Vercel project env. If a provider's vars are missing,
> `isMillitrackConfigured()` / `isWheelsEyeConfigured()` return `false` and that
> provider is silently skipped (the other still runs).

---

## 7. Diagnostic scripts (run locally)

Both connect with the same env (`node --env-file=.env.local ...`) and are
read-only — they never print credentials or tokens.

| Script | What it does |
|--------|--------------|
| [`scripts/test-millitrack.mjs`](../scripts/test-millitrack.mjs) | Full Millitrack smoke test: login → `/api/devices` → 7-day summary for the first device. |
| [`scripts/list-millitrack-devices.mjs`](../scripts/list-millitrack-devices.mjs) | Dumps the id ↔ registration map (the `name` field embeds the plate as its first token, e.g. `"UP41RT2933 SUDHIYAMAU (FRT 16)"`). |

```bash
node --env-file=.env.local scripts/test-millitrack.mjs
node --env-file=.env.local scripts/list-millitrack-devices.mjs
```

---

## 8. Where the data surfaces in the UI

`vehicle_gps_distance` rows are read back via `lib/data.ts`:

- **`/fuel` dashboard** — monthly "KM (GPS)" column and the fleet "average"
  (`km ÷ litres`), per selected month.
- **Vehicle profile → "GPS Distance" tab** — month-wise history table.
- **Vehicle profile → "Fuel Logs" tab** & **`/fuel-log`** — per-fill "Avg km/L"
  (this uses the Millitrack per-segment value on `vehicle_fuel_logs`, not the
  monthly table).

---

## 9. TL;DR for a new developer

1. A vehicle's `gps_company` (`VehicleStep` or `WheelsEye`) decides the provider.
2. **Millitrack**: JWT login → `x-auth-token` → one summary call **per vehicle**
   per month, matched by **numeric device id**, distance in **meters**.
3. **WheelsEye**: UUID login → `token` header → one report call for **all**
   vehicles per month, matched by **registration number**, distance in **km**.
4. The orchestrator (`syncMonthlyGpsDistance`) handles IST months, splits by
   provider, and upserts month totals into `vehicle_gps_distance`.
5. It runs on a "Sync GPS Data" button and a daily cron; errors are counted, not
   fatal; each vehicle needs a **non-null `gps_device_id`** to be picked up.
