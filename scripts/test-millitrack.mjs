/**
 * Live Millitrack connectivity test (Android JWT API, auto-login).
 * Run: node --env-file=.env.local scripts/test-millitrack.mjs
 *   or: MT_USERNAME="imperial.barabanki" MT_PASSWORD="..." node scripts/test-millitrack.mjs
 *
 * Verifies the same login → token → devices → summary path that lib/millitrack.ts uses.
 * Read-only. Does NOT print credentials or the token.
 */

const BASE = process.env.MT_BASE_URL ?? "http://track4.millitrack.com";
const APP_ID = "in.vehiclestep.vehiclesteppro.gpstracker";

function fail(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

async function login() {
  if (process.env.MT_TOKEN) {
    console.log("✓ Using fixed MT_TOKEN (no login)");
    return process.env.MT_TOKEN;
  }
  const username = process.env.MT_USERNAME || process.env.MT_EMAIL;
  const password = process.env.MT_PASSWORD;
  if (!username || !password) fail("MT_USERNAME (or MT_EMAIL) / MT_PASSWORD not loaded from .env.local");
  console.log(`• Logging in as ${username.replace(/(.{2}).*/, "$1***")} ...`);

  const url = `${BASE}/api/session?app=${encodeURIComponent(APP_ID)}&dc=${Date.now()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ username, password }),
  });
  if (!res.ok) fail(`Login failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json().catch(() => null);
  if (!data?.token) fail("Login OK but no token in response body");
  console.log("✓ Login OK, JWT received");
  return data.token;
}

async function getDevices(token) {
  const res = await fetch(`${BASE}/api/devices`, {
    headers: { Accept: "application/json", "x-auth-token": token },
  });
  if (!res.ok) fail(`/api/devices failed: ${res.status}`);
  return res.json();
}

async function getSummary(token, deviceId, fromISO, toISO) {
  const params = new URLSearchParams({ from: fromISO, to: toISO, mail: "false" });
  params.append("deviceId", String(deviceId));
  params.set("startHour", "0");
  params.set("startMinute", "0");
  params.set("endHour", "0");
  params.set("endMinute", "0");
  params.set("useTimeAsInterval", "false");
  params.set("dc", String(Date.now()));
  const res = await fetch(`${BASE}/api/reports/summary?${params.toString()}`, {
    headers: { Accept: "application/json", "x-auth-token": token },
  });
  if (!res.ok) fail(`/api/reports/summary failed: ${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

async function main() {
  console.log(`Base URL: ${BASE}\n`);
  const token = await login();

  const devices = await getDevices(token);
  console.log(`\n✓ Devices fetched: ${devices.length}`);
  console.log("  First few (id → name → uniqueId → status):");
  for (const d of devices.slice(0, 8)) {
    console.log(`   ${d.id}\t${d.name ?? "—"}\t${d.uniqueId ?? "—"}\t${d.status ?? "—"}`);
  }
  if (devices.length > 8) console.log(`   ... and ${devices.length - 8} more`);

  if (devices.length === 0) {
    console.log("\n⚠ No devices on this account — can't test summary.");
    return;
  }

  // Test summary on the first device, last 7 days (one aggregate row for the range)
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 86400000);
  const dev = devices[0];
  console.log(`\n• Summary for device ${dev.id} (${dev.name ?? "—"}), last 7 days ...`);
  const rows = await getSummary(token, dev.id, from.toISOString(), now.toISOString());
  console.log(`✓ Summary rows: ${rows.length}`);
  let totalKm = 0;
  for (const r of rows) {
    const km = (r.distance ?? r.distanceTravelled ?? 0) / 1000;
    totalKm += km;
    console.log(
      `   ${(r.startTime ?? "").slice(0, 10)} → ${(r.endTime ?? "").slice(0, 10)}` +
        `  ${km.toFixed(1)} km  (fuel: ${r.mileageFuelConsumed ?? r.spentFuel ?? "—"})`,
    );
  }
  console.log(`\n✓ 7-day total distance for device ${dev.id}: ${totalKm.toFixed(1)} km`);
  console.log("\n✅ Millitrack integration verified end-to-end.");
}

main().catch((e) => fail(e.message));
