/**
 * Lists all Millitrack devices for GPS-device-ID mapping.
 * Run: node --env-file=.env.local scripts/list-millitrack-devices.mjs
 *   or: MT_USERNAME="imperial.barabanki" MT_PASSWORD="..." node scripts/list-millitrack-devices.mjs
 *
 * "Device ID" column → paste this numeric id into each vehicle's GPS Device ID field.
 * "Registration" is the first token of the device name (the plate the device reports).
 *
 * Uses the Android API (track4.millitrack.com) with auto-login — same as lib/millitrack.ts.
 */

const BASE = process.env.MT_BASE_URL ?? "http://track4.millitrack.com";
const APP_ID = "in.vehiclestep.vehiclesteppro.gpstracker";

async function login() {
  if (process.env.MT_TOKEN) return process.env.MT_TOKEN;
  const username = process.env.MT_USERNAME || process.env.MT_EMAIL;
  const password = process.env.MT_PASSWORD;
  if (!username || !password) {
    console.error("MT_USERNAME (or MT_EMAIL) / MT_PASSWORD not loaded. Run with: node --env-file=.env.local scripts/list-millitrack-devices.mjs");
    process.exit(1);
  }
  const url = `${BASE}/api/session?app=${encodeURIComponent(APP_ID)}&dc=${Date.now()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ username, password }),
  });
  if (!res.ok) {
    console.error(`Login failed: ${res.status}`);
    process.exit(1);
  }
  const data = await res.json().catch(() => null);
  if (!data?.token) {
    console.error("Login OK but no token in response");
    process.exit(1);
  }
  return data.token;
}

async function main() {
  const token = await login();

  const devRes = await fetch(`${BASE}/api/devices`, {
    headers: { Accept: "application/json", "x-auth-token": token },
  });
  if (!devRes.ok) {
    console.error(`/api/devices failed: ${devRes.status}`);
    process.exit(1);
  }
  const devices = await devRes.json();

  // Sort by registration (first token of name) for easy scanning
  const rows = devices
    .map((d) => {
      const name = (d.name ?? "").trim();
      const registration = name.split(/\s+/)[0] || "—";
      return { id: d.id, registration, name: name || "—", status: d.status ?? "—" };
    })
    .sort((a, b) => a.registration.localeCompare(b.registration));

  console.log(`\nTotal devices: ${rows.length}\n`);
  console.log("Device ID  | Registration   | Status   | Full device name");
  console.log("-----------|----------------|----------|------------------------------------------");
  for (const r of rows) {
    console.log(
      `${String(r.id).padEnd(10)} | ${r.registration.padEnd(14)} | ${String(r.status).padEnd(8)} | ${r.name}`,
    );
  }
  console.log("\nNote: app me registration spaces ke saath ho sakti hai (UP41 RT 2933) —");
  console.log("device id daalte waqt sirf numeric 'Device ID' column use karein.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
