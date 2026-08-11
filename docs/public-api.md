# Public API

Two open, read-only JSON endpoints live under `/api/public`. They need **no login, no API key, no token** — `middleware.ts` whitelists the `/api/public` prefix, and both send `Access-Control-Allow-Origin: *` so any site, script or spreadsheet can read them directly.

Both are `Cache-Control: no-store`, so every hit returns live VMS data.

## Base URLs

| Environment | Base URL |
| --- | --- |
| Production | `https://frtvms.vercel.app` |
| Local dev | `http://localhost:3000` (`npm run dev`) |

Paste-ready live links:

- <https://frtvms.vercel.app/api/public/gps-names?provider=VehicleStep>
- <https://frtvms.vercel.app/api/public/gps-names?provider=WheelsEye>
- <https://frtvms.vercel.app/api/public/gps-names> (both providers)
- <https://frtvms.vercel.app/api/public/vehicles>

---

## `GET /api/public/gps-names`

Maps a GPS vendor's devices to their VMS deployment label — the same label the GPS platforms are renamed to from `/vehicles/gps-names`, e.g. `FRT 3 J.P NAGAR (UP41CT6929)`.

### Request

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

### Response

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

| Field | Meaning |
| --- | --- |
| `provider` | The resolved provider, or `"all"` when the param was omitted |
| `providers` | Every `gps_company` value present in the fleet — useful for discovering valid inputs |
| `count` | Number of vehicles in this response |
| `generated_at` | ISO timestamp of the read |
| `by_device_id` | `gps_device_id` → label |
| `by_vehicle_no` | Registration number (uppercase, as stored) → label |

Both maps carry the **same** label, so a caller can look up by whichever key it holds.

### Rules

- **Only `status = "active"` vehicles are returned.** A standby / accident / removed vehicle no longer holds its FRT number or substation — those belong to whichever vehicle is deployed there now — so including it would duplicate a live label.
- The label is built by `millitrackDeviceName()` in `lib/device-naming.ts`: `"<FRT no> <substation> (<registration>)"`. If a vehicle has no FRT number or substation, the label falls back to just the registration.
- A vehicle with a blank `gps_device_id` is skipped in `by_device_id` but still appears in `by_vehicle_no`.
- If two vehicles somehow share one device id, the first (lowest FRT number) wins rather than being silently overwritten.
- Entries are ordered by FRT number (FRT 2 before FRT 10), unnumbered last.

### Example consumer

```js
const res = await fetch("https://frtvms.vercel.app/api/public/gps-names?provider=WheelsEye");
const { by_device_id } = await res.json();
const label = by_device_id["3834096"]; // "FRT 9 CHANDAULI (UP32PN7247)"
```

---

## `GET /api/public/vehicles`

The fleet's basic deployment + GPS + vendor fields as an array. Supports `?frt=FRT 1` and `?reg=UP41` filters; excludes `removed` vehicles only (standby / accident are included, unlike `gps-names`).

Returns `{ count, vehicles: [{ registration_no, frt_no, circle, division, substation, gps_company, gps_device_id, vendor_name, status }] }`.

---

## Security note

These endpoints are intentionally unauthenticated. Anyone with the URL can read FRT ↔ substation ↔ registration ↔ GPS device id mappings. They expose no owner/driver contact details, no documents and no user data, and they are read-only — but treat the GPS device ids as public once the URL is shared.
