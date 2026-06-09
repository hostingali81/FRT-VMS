# Vehicle Info Workflow

Pulls RTO / vehicle registration details for the fleet from Cars24's public
`service-history` API — no login and no per-account verification limit.

Files:

- `Vehicles.xlsx` - source list of vehicle numbers (the `Vehicle Number` column
  is the input).
- `scripts/fetch-cars24-info.mjs` - fetches RTO details for every vehicle.
- `cars24-rto-info.csv` - output.

## Usage

```powershell
npm run cars24:fetch
```

- Pure HTTP (no browser). Endpoint:
  `GET https://cars-consumer.cars24.team/api/v1/product/service-history?regNumber=<REG>`
  with header `x-client-type: MWEB`. The richest payload is the `full_details`
  JSON embedded in the response.
- Reads vehicle numbers from `Vehicles.xlsx`; writes `cars24-rto-info.csv`.
  60+ columns: maker/model, fuel, body type, cubic capacity, weights, cylinders,
  RC status, fitness/PUC/tax dates, insurance company + policy no, financier,
  permit, and masked owner/address/engine/chassis.
- Resumable: vehicles already in the CSV are skipped. A vehicle Cars24 has no
  record for is logged as "no data" and retried on the next run, so just re-run
  to pick up stragglers.

```powershell
# custom input / output paths
npm run cars24:fetch -- path\to\vehicles.xlsx path\to\output.csv
```
