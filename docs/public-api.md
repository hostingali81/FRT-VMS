# FRT VMS Public API

Open, read-only JSON endpoints for the FRT fleet: **fuel consumption, mileage, distance and vehicle details**. They need **no login, no API key, no token** — `middleware.ts` whitelists the `/api/public` prefix, and every endpoint sends `Access-Control-Allow-Origin: *`, so any website, script, mobile app or spreadsheet can read them directly.

Every response is `Cache-Control: no-store`, so each call returns live VMS data.

## Base URL

| Environment | Base URL |
| --- | --- |
| Production | `https://frtvms.vercel.app` |
| Local dev | `http://localhost:3000` (`npm run dev`) |

This reference is served publicly at <https://frtvms.vercel.app/api-docs>.

## Endpoints at a glance

| Endpoint | What it gives you |
| --- | --- |
| `GET /api/public/fuel` | Per-vehicle fuel fill-ups, litres, cost, distance and mileage (km/L) — the Fuel Dashboard as JSON |
| `GET /api/public/vehicles` | The fleet's deployment, GPS and vendor fields as a flat array |
| `GET /api/public/gps-names` | GPS device id ↔ FRT deployment label, per tracking provider |

Paste-ready live links:

- <https://frtvms.vercel.app/api/public/fuel>
- <https://frtvms.vercel.app/api/public/fuel?month=all>
- <https://frtvms.vercel.app/api/public/vehicles>
- <https://frtvms.vercel.app/api/public/gps-names>

## Conventions

- **Method** — `GET` only. `OPTIONS` is answered for CORS preflight; anything else returns `405`.
- **Content type** — `application/json`, UTF-8 encoded.
- **Units** — distance in kilometres, fuel in litres, money in **INR (₹)**, mileage in **km/L**. Dates are `YYYY-MM-DD`; timestamps are ISO-8601 UTC. Operational dates (a fill's `log_date`, the month boundaries) are **IST (Asia/Kolkata)** calendar dates.
- **Nulls mean "not known", zero means "measured as zero".** A vehicle with `distance_km: 0` was tracked and did not move; one whose GPS was never synced also reports `0` but carries `gps.tracked` and `months_with_gps_data` so you can tell the two apart. `mileage.kmpl: null` always comes with an `unavailable_reason`.
- **Rounding** — litres, cost and distance to 2 decimals; km/L to 1 decimal, matching the dashboard.
- **Stability** — fields are added, not renamed or removed. Ignore unknown keys.
- **Rate limits** — none enforced. Please cache on your side rather than polling in a tight loop; the whole fleet comes back in one call.

---

## `GET /api/public/fuel`

The Fuel Dashboard as JSON. One object per vehicle carrying its identity, deployment and GPS details, plus three sets of numbers:

1. `period` — the reporting window you asked for (default: the current month)
2. `all_time` — every fuel entry the VMS holds for that vehicle
3. `monthly` — an optional month-by-month breakdown

Fleet-wide `totals` sit alongside, computed under exactly the rules the dashboard's summary strip uses.

```bash
curl "https://frtvms.vercel.app/api/public/fuel?month=2026-08"
```

### Query parameters

All are optional. Unknown values return `400` with a `hint` telling you the valid ones.

| Parameter | Default | Description |
| --- | --- | --- |
| `month` | current month | Reporting window, `YYYY-MM`. Use `month=all` for the whole history. |
| `from`, `to` | — | A month range, both `YYYY-MM` (inclusive). Overrides `month`. Either one alone means a single month. |
| `status` | `active` | Comma-separated vehicle statuses, or `all`. Valid: `active`, `maintenance`, `breakdown`, `standby`, `accident`, `removed`. |
| `ownership` | — | `company` or `vendor` — who pays for the fuel. |
| `reg` | — | Registration number, partial and case/space-insensitive (`up41ct` matches `UP41CT6926`). |
| `frt` | — | FRT posting number. `frt=3`, `frt=FRT 3` and `frt=frt3` are equivalent. |
| `circle`, `division`, `substation` | — | Location name (partial, case-insensitive) or its UUID. |
| `vendor` | — | Vendor name, partial and case-insensitive. |
| `include` | — | Comma-separated extras: `logs` (every fill-up), `months` (per-month breakdown), or `all`. |
| `sort` | `frt` | `frt`, `registration`, `fills`, `litres`, `cost`, `km`, `mileage`. |
| `order` | — | `asc` or `desc`. Defaults to ascending for `frt`/`registration`, descending for the metric sorts. |

> `month=all` reports every fill ever recorded and sums the GPS distance of every synced month. Combined with `include=months` it is the fastest way to pull the fleet's complete fuel history in one request.

### Choosing the window

| You want | Call |
| --- | --- |
| This month, active fleet | `/api/public/fuel` |
| A specific month | `/api/public/fuel?month=2026-07` |
| A quarter | `/api/public/fuel?from=2026-06&to=2026-08` |
| Everything on record | `/api/public/fuel?month=all` |
| One vehicle, with every fill listed | `/api/public/fuel?reg=UP41CT6926&month=all&include=logs` |
| One substation's vehicles this month | `/api/public/fuel?substation=OBRI` |
| Fleet ranked by mileage | `/api/public/fuel?ownership=company&sort=mileage` |

**Only vehicles the fleet actually runs are returned by default** (`status=active`). A standby, accident or removed vehicle no longer holds its FRT number or substation — those belong to whichever vehicle is deployed there now — so counting it would double-count a posting. Pass `status=all` when you want the full register.

### Response

```json
{
  "meta": {
    "generated_at": "2026-08-30T09:26:39.524Z",
    "timezone": "Asia/Kolkata",
    "currency": "INR",
    "source": "FRT Vehicle Management System",
    "docs": "https://frtvms.vercel.app/api-docs",
    "period": {
      "label": "August 2026",
      "all_time": false,
      "months": ["2026-08"],
      "from": "2026-08-01",
      "to": "2026-08-31"
    },
    "filters": {
      "status": ["active"],
      "ownership": null,
      "reg": null,
      "frt": null,
      "circle": null,
      "division": null,
      "substation": null,
      "vendor": null,
      "sort": "frt",
      "order": null,
      "include": []
    },
    "vehicle_count": 48,
    "fleet_size": 52
  },
  "totals": {
    "vehicles": 48,
    "company_fuelled_vehicles": 19,
    "vendor_fuelled_vehicles": 29,
    "fill_ups": 211,
    "fuel_litres": 2094.01,
    "fuel_cost_inr": 90371.9,
    "distance_km": 43260.98,
    "company_fuel_distance_km": 15280.51,
    "average_mileage_kmpl": 6.4
  },
  "vehicles": [ "…one object per vehicle, see below…" ]
}
```

#### `meta`

| Field | Meaning |
| --- | --- |
| `generated_at` | ISO timestamp of this read |
| `period.label` | Human label — `"August 2026"`, `"June 2026 – August 2026"` or `"All time"` |
| `period.months` | The `YYYY-MM` months covered, or `null` for `month=all` |
| `period.from`, `period.to` | Window edges. For `month=all` these are the earliest and latest fill dates actually found |
| `filters` | Every filter as the server resolved it — echo it back in your UI so a report can never misrepresent its own scope |
| `vehicle_count` | Vehicles in this response (after filters) |
| `fleet_size` | Vehicles in the VMS altogether, before filters |

#### `totals`

Fleet roll-up for the **period**, under the dashboard's rules:

| Field | Meaning |
| --- | --- |
| `vehicles` | Vehicles matching the filters |
| `company_fuelled_vehicles` / `vendor_fuelled_vehicles` | Split by who buys the fuel |
| `fill_ups`, `fuel_litres`, `fuel_cost_inr` | **Company-fuelled vehicles only** — the company does not pay for, and does not log, vendor fuel |
| `distance_km` | GPS distance of **every** vehicle in the selection |
| `company_fuel_distance_km` | GPS distance of the company-fuelled vehicles alone |
| `average_mileage_kmpl` | Fleet average: total mileage-window distance ÷ total mileage-window fuel, across company-fuelled vehicles. Weighted by fuel used, so a heavy vehicle counts more than a light one — it is **not** the mean of the per-vehicle numbers |

> A vendor-fuelled vehicle still reports its own `period` figures if entries exist for it; it is only excluded from the fuel columns of the fleet total. That is deliberate and matches the dashboard.

### A vehicle object

```json
{
  "vehicle_id": "aef28eef-45ed-4ead-ac66-1ceaf0577016",
  "registration_no": "UP41CT6926",
  "frt_no": "FRT 1",
  "status": "active",
  "fuel_ownership": "company",
  "vehicle": {
    "type": "SUPER CARRY STD (O) CNG",
    "fuel_type": "CNG",
    "model_year": 2025,
    "owner_name": "IMPERIAL",
    "vendor_name": "IMPERIAL",
    "driver_ownership": "company",
    "notes": null
  },
  "location": {
    "circle": "EDC-Barabanki",
    "division": "EDD-BARABANKI",
    "substation": "OBRI (OLD)",
    "home_circle": "EDC-Barabanki",
    "assigned_from": "2025-11-01"
  },
  "gps": { "company": "VehicleStep", "device_id": "229016", "tracked": true },
  "period": {
    "fill_ups": 11,
    "fuel_litres": 47.78,
    "fuel_cost_inr": 4803,
    "avg_rate_per_litre_inr": 100.52,
    "distance_km": 506.3,
    "cost_per_km_inr": 9.49,
    "first_fill_date": "2026-08-03",
    "last_fill_date": "2026-08-27",
    "fuel_types_used": ["CNG", "Petrol"],
    "mileage": {
      "kmpl": 11.7,
      "fuel_type": "CNG",
      "method": "tankful",
      "by_fuel_type": [
        {
          "fuel_type": "CNG",
          "kmpl": 11.7,
          "distance_km": 451.93,
          "litres": 38.79,
          "fills": 9,
          "from_date": "2026-08-03",
          "to_date": "2026-08-27"
        },
        {
          "fuel_type": "Petrol",
          "kmpl": 26.8,
          "distance_km": 52.61,
          "litres": 1.96,
          "fills": 2,
          "from_date": "2026-08-08",
          "to_date": "2026-08-11"
        }
      ],
      "unavailable_reason": null,
      "window": { "distance_km": 451.93, "litres": 38.79 }
    }
  },
  "all_time": {
    "fill_ups": 11,
    "fuel_litres": 47.78,
    "fuel_cost_inr": 4803,
    "distance_km": 1633.03,
    "months_with_gps_data": 3,
    "mileage": { "kmpl": 11.7, "fuel_type": "CNG", "by_fuel_type": [] }
  }
}
```

#### Identity and deployment

| Field | Meaning |
| --- | --- |
| `vehicle_id` | VMS UUID — the stable key to join on |
| `registration_no` | Number plate, as stored (uppercase, no spaces) |
| `frt_no` | FRT posting number, derived from the substation the vehicle currently sits at |
| `status` | `active`, `maintenance`, `breakdown`, `standby`, `accident` or `removed` |
| `fuel_ownership` | `company` or `vendor` — who buys the fuel |
| `vehicle.type` | Model / variant as recorded on the RC |
| `vehicle.fuel_type` | The vehicle's registered fuel. A bi-fuel vehicle may still log a second type — trust `period.fuel_types_used` for what actually went in |
| `vehicle.driver_ownership` | Whether the driver is on the company's or the vendor's rolls |
| `location.circle` | Where the vehicle is deployed **now** (falls back to `home_circle` when unassigned) |
| `location.home_circle` | The circle the vehicle belongs to on paper |
| `location.assigned_from` | Date the current posting started |
| `gps.tracked` | `false` means no GPS device is fitted, so every distance for it will read `0` |

#### `period` and `all_time`

Identical shapes. `period` covers the window you asked for; `all_time` covers every entry on record, regardless of `month`/`from`/`to`.

| Field | Meaning |
| --- | --- |
| `fill_ups` | **How many times fuel was put in** during the window |
| `fuel_litres` | Total litres filled |
| `fuel_cost_inr` | Total ₹ spent |
| `avg_rate_per_litre_inr` | `fuel_cost_inr ÷ fuel_litres` — the effective pump rate |
| `distance_km` | **How far the vehicle drove**, from the monthly GPS odometer sync — every km it moved in the window, whether or not it was fuelled |
| `cost_per_km_inr` | `fuel_cost_inr ÷ distance_km` — running cost per kilometre |
| `first_fill_date`, `last_fill_date` | Window edges of the actual entries, `null` when there were none |
| `fuel_types_used` | Distinct fuel types actually filled in the window |
| `mileage` | km/L — see the next section |
| `all_time.months_with_gps_data` | How many months of GPS distance have been synced for this vehicle |

> `distance_km` and `mileage.*.distance_km` are **different numbers on purpose**. `distance_km` is every kilometre the vehicle moved in the window. The mileage distance only spans the vehicle's first fill to its last fill, so it is always the smaller of the two. Use `distance_km` for utilisation, and `mileage.kmpl` for efficiency.

### How mileage (km/L) is calculated

FRT drivers fill up when the tank is near empty, so mileage uses the **tankful method** — the same maths the Fuel Dashboard puts on screen (`lib/mileage.ts`), never a raw "month distance ÷ month litres":

```text
distance = Σ GPS km of every fill in the window,   EXCEPT the window's first fill
fuel     = Σ litres of every fill in the window,   EXCEPT the latest fill
km/L     = distance ÷ fuel
```

Both exclusions matter:

- Each fill records `segment_distance_km` — the GPS distance driven **since the previous fill of the same fuel type**. The first fill's segment was driven *before* the window opened, so it belongs to the previous period, not this one.
- The latest fill's litres are **still sitting in the tank**. Counting fuel that hasn't been burned yet would drag km/L down.

#### Worked example

Three CNG fills in the window:

| Fill | Date | Litres | Segment km | Counts as distance? | Counts as fuel? |
| --- | --- | --- | --- | --- | --- |
| 1 | 03 Aug | 5.00 | 42.1 | No — window's first fill | Yes |
| 2 | 09 Aug | 4.20 | 48.6 | Yes | Yes |
| 3 | 16 Aug | 5.07 | 58.6 | Yes | No — still in the tank |

```text
distance = 48.6 + 58.6 = 107.2 km
fuel     = 5.00 + 4.20 =   9.20 L
km/L     = 107.2 ÷ 9.20 = 11.7
```

#### Bi-fuel vehicles

A CNG vehicle that also takes a small petrol dose to start cannot be measured on a combined tankful — CNG litres and petrol litres are not additive. So the fuel is split by type and the tankful method runs on each type separately. That is why `by_fuel_type` is an array:

- `kmpl` and `fuel_type` at the top report the **dominant** fuel (the one that burned the most litres) — the figure the dashboard shows at full size and the one a fleet report should quote.
- The secondary fuel's km/L is real but computed off a couple of litres, so it swings wildly. Treat it as diagnostic, not as a performance number.
- `window` is the dominant fuel's distance and litres — the raw pair the fleet average is weighted by.

#### When mileage is unavailable

`kmpl` is `null` — never a guess — whenever the window cannot support an honest figure. `unavailable_reason` says which case you hit:

| `unavailable_reason` | What to do |
| --- | --- |
| `no fuel entries in this window` | Nothing was logged. Widen the window or check `all_time`. |
| `needs at least 2 fills of the same fuel type in this window` | One fill can't measure a distance between fills. Use a longer window. |
| `GPS distance not synced yet for one or more fills in this window` | The fill exists but its GPS segment hasn't been fetched. A partial number would read falsely low, so none is given — it appears after the next GPS sync. |
| `fuel burned in this window works out to zero` | Every fill but the latest was 0 L. Check the entries. |

### `include=logs` — every fill-up

Adds `period.logs`, newest first, listing each entry in the window.

```bash
curl "https://frtvms.vercel.app/api/public/fuel?reg=UP41CT6926&month=all&include=logs"
```

```json
{
  "date": "2026-08-27",
  "logged_at": "2026-08-27T16:35:00+00:00",
  "fuel_type": "CNG",
  "litres": 5.07,
  "amount_inr": 512,
  "rate_per_litre_inr": 100.99,
  "segment_distance_km": 58.59,
  "entry_kmpl": 11.6,
  "gps_synced_at": "2026-08-28T18:54:10.797+00:00",
  "recorded_by": "Aditya Kumar Yadav",
  "notes": null
}
```

| Field | Meaning |
| --- | --- |
| `date` | Calendar date of the fill (IST) |
| `logged_at` | Approximate instant of the fill when the operator recorded one — sharpens the GPS segment. Often `null` |
| `litres`, `amount_inr`, `rate_per_litre_inr` | What went in and what it cost |
| `segment_distance_km` | GPS km since the previous fill **of the same fuel type**. `null` until the GPS sync runs |
| `entry_kmpl` | `segment_distance_km ÷ litres` for this row alone — the indicative figure the app's Fuel Logs tab shows. **Not** the tankful mileage: it divides this segment by *this* fill instead of the previous one, so it is only a rough per-entry sanity check. Quote `mileage.kmpl` in reports |
| `gps_synced_at` | When that segment was last refreshed |
| `recorded_by` | Name of the operator who entered the row |

### `include=months` — month-by-month

Adds a `monthly` array to each vehicle, one entry per month, each with the same fields as `period`. With `month=all` you get every month that has data; with a range you get exactly the months you asked for, including the empty ones.

```bash
curl "https://frtvms.vercel.app/api/public/fuel?reg=UP41CT6926&month=all&include=months"
```

```json
"monthly": [
  { "year_month": "2026-06", "label": "June 2026", "fill_ups": 0, "fuel_litres": 0, "distance_km": 499.32, "mileage": { "kmpl": null } },
  { "year_month": "2026-07", "label": "July 2026", "fill_ups": 0, "fuel_litres": 0, "distance_km": 627.41, "mileage": { "kmpl": null } },
  { "year_month": "2026-08", "label": "August 2026", "fill_ups": 11, "fuel_litres": 47.78, "distance_km": 506.3, "mileage": { "kmpl": 11.7 } }
]
```

Use `include=logs,months` (or `include=all`) to get both.

### Examples

Fleet fuel cost for a month, in the shell:

```bash
curl -s "https://frtvms.vercel.app/api/public/fuel?month=2026-08" | jq '.totals'
```

The five thirstiest company vehicles:

```bash
curl -s "https://frtvms.vercel.app/api/public/fuel?ownership=company&sort=litres" \
  | jq -r '.vehicles[:5][] | "\(.frt_no)\t\(.registration_no)\t\(.period.fuel_litres) L\t\(.period.mileage.kmpl // "-") km/L"'
```

A monthly report in JavaScript:

```js
const res = await fetch("https://frtvms.vercel.app/api/public/fuel?month=2026-08&ownership=company");
const { totals, vehicles } = await res.json();

console.log(`Fleet: ${totals.fuel_litres} L, ₹${totals.fuel_cost_inr}, ${totals.average_mileage_kmpl} km/L`);

for (const v of vehicles) {
  const { fill_ups, fuel_litres, distance_km, mileage } = v.period;
  console.log(
    `${v.frt_no ?? "—"} ${v.registration_no}: ${fill_ups} fills, ${fuel_litres} L, ` +
      `${distance_km} km, ${mileage.kmpl ?? mileage.unavailable_reason}`,
  );
}
```

Pull the full history into a table in Python:

```python
import requests, pandas as pd

data = requests.get(
    "https://frtvms.vercel.app/api/public/fuel",
    params={"month": "all", "include": "months", "status": "all"},
).json()

rows = [
    {
        "registration": v["registration_no"],
        "frt": v["frt_no"],
        "substation": v["location"]["substation"],
        "month": m["year_month"],
        "fills": m["fill_ups"],
        "litres": m["fuel_litres"],
        "cost": m["fuel_cost_inr"],
        "km": m["distance_km"],
        "kmpl": m["mileage"]["kmpl"],
    }
    for v in data["vehicles"]
    for m in v["monthly"]
]

print(pd.DataFrame(rows).to_string())
```

Live cell in Google Sheets (the JSON needs a helper, so fetch a single figure with Apps Script):

```js
function fleetLitres(month) {
  const url = "https://frtvms.vercel.app/api/public/fuel?month=" + month;
  return JSON.parse(UrlFetchApp.fetch(url).getContentText()).totals.fuel_litres;
}
```

---

## `GET /api/public/vehicles`

The fleet's basic deployment, GPS and vendor fields as a flat array — a lighter call than `/api/public/fuel` when you only need the register.

| Query param | Notes |
| --- | --- |
| `frt` | Exact FRT number, case-insensitive |
| `reg` | Registration number, partial and case/space-insensitive |

```bash
curl "https://frtvms.vercel.app/api/public/vehicles?frt=FRT%201"
```

```json
{
  "count": 1,
  "vehicles": [
    {
      "registration_no": "UP41CT6926",
      "frt_no": "FRT 1",
      "circle": "EDC-Barabanki",
      "division": "EDD-BARABANKI",
      "substation": "OBRI (OLD)",
      "gps_company": "VehicleStep",
      "gps_device_id": "229016",
      "vendor_name": "IMPERIAL",
      "status": "active"
    }
  ]
}
```

Excludes `removed` vehicles only — standby and accident vehicles are included, unlike `/api/public/gps-names`.

---

## `GET /api/public/gps-names`

Maps a GPS vendor's devices to their VMS deployment label — the same label the GPS platforms are renamed to from `/vehicles/gps-names`, e.g. `FRT 3 J.P NAGAR (UP41CT6929)`.

| Query param | Required | Notes |
| --- | --- | --- |
| `provider` (alias: `owner`) | No | GPS company name. Omit it to get every provider. |

Provider matching ignores case, spaces and the common misspellings:

| You send | Resolves to |
| --- | --- |
| `VehicleStep`, `vehiclestep`, `millitrack` | `VehicleStep` |
| `WheelsEye`, `wheelseye`, `Wheeleye`, `wheels eye` | `WheelsEye` |

```bash
curl "https://frtvms.vercel.app/api/public/gps-names?provider=WheelsEye"
```

```json
{
  "provider": "WheelsEye",
  "providers": ["VehicleStep", "WheelsEye"],
  "count": 7,
  "generated_at": "2026-08-11T10:07:40.581Z",
  "by_device_id": {
    "3834096": "FRT 9 CHANDAULI (UP32PN7247)",
    "3849695": "FRT 45 MOHANA (UP41CT6303)"
  },
  "by_vehicle_no": {
    "UP32PN7247": "FRT 9 CHANDAULI (UP32PN7247)",
    "UP41CT6303": "FRT 45 MOHANA (UP41CT6303)"
  }
}
```

Both maps carry the **same** label, so a caller can look up by whichever key it holds.

### Rules

- **Only `status = "active"` vehicles are returned**, for the same reason the fuel endpoint defaults to active: a standby or removed vehicle no longer holds the FRT number and substation that make up the label.
- The label comes from `millitrackDeviceName()` in `lib/device-naming.ts`: `"<FRT no> <substation> (<registration>)"`, falling back to just the registration when the FRT number or substation is missing.
- A vehicle with a blank `gps_device_id` is skipped in `by_device_id` but still appears in `by_vehicle_no`.
- If two vehicles somehow share one device id, the first (lowest FRT number) wins rather than being silently overwritten.
- Entries are ordered by FRT number (FRT 2 before FRT 10), unnumbered last.

---

## Errors

A bad parameter returns HTTP `400` with a machine-readable body — never a partial or silently corrected result:

```json
{
  "error": "bad_request",
  "message": "Invalid month \"abcd\".",
  "hint": "Use month=YYYY-MM (e.g. month=2026-08), or month=all.",
  "docs": "https://frtvms.vercel.app/api-docs"
}
```

| Status | When |
| --- | --- |
| `200` | Success. An empty `vehicles` array is a success, not an error — the filters matched nothing |
| `400` | Malformed month, inverted range, or an unknown `status` / `ownership` / `sort` / `order` value |
| `405` | Any method other than `GET` or `OPTIONS` |

## Where the numbers come from

- **Fuel entries** are keyed in by hand at the pump, per fill, for company-fuelled vehicles. Nothing is estimated.
- **Distance is GPS, not odometer.** It comes from the tracking providers (VehicleStep/Millitrack and WheelsEye) through the VMS's monthly sync. A vehicle with no GPS device (`gps.tracked: false`) will always report `0` km and no mileage.
- **The monthly distance is a stored snapshot.** `distance_km` for a past month is frozen at whatever the last sync wrote; the current month keeps moving until the next sync. `all_time.months_with_gps_data` tells you how many months have ever been synced.
- **Per-fill segments are per fuel type.** `segment_distance_km` is the distance since the previous fill of the *same* fuel, which is what makes bi-fuel mileage possible.
- **Corrections rewrite history.** Fuel entries can be edited in the VMS, so a report for a past month can legitimately change. Store `generated_at` next to anything you archive.
- **Fleet composition changes.** FRT numbers follow the substation, not the vehicle. Join on `vehicle_id` if you need a stable key across months.

## Security note

These endpoints are intentionally unauthenticated. Anyone with the URL can read registration ↔ FRT ↔ substation ↔ GPS device id mappings, vendor and owner names, the fuel figures, and the operator name on each fill.

They deliberately **do not** expose vehicle documents (insurance / fitness / pollution expiry, RC copies), owner or vendor mobile numbers, driver records, user accounts, or anything else about people — this is a fuel and mileage feed, nothing more. They are read-only — no endpoint here can change VMS data — but treat everything above as public once the URL is shared.
