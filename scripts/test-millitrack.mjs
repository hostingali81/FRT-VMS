/**
 * Live Millitrack (Traccar) connectivity test.
 * Run: node --env-file=.env.local scripts/test-millitrack.mjs
 *
 * Verifies the same login + cookie-parse + summary path that lib/millitrack.ts uses.
 * Read-only. Does NOT print credentials.
 */

const BASE = process.env.MT_BASE_URL ?? "https://mvts4.millitrack.com";

function fail(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

async function login() {
  const email = process.env.MT_EMAIL;
  const password = process.env.MT_PASSWORD;
  if (!email || !password) fail("MT_EMAIL / MT_PASSWORD not loaded from .env.local");
  console.log(`• Logging in as ${email.replace(/(.{2}).*(@.*)/, "$1***$2")} ...`);

  const res = await fetch(`${BASE}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }),
  });
  if (!res.ok) fail(`Login failed: ${res.status} ${(await res.text()).slice(0, 200)}`);

  // Same parse as lib/millitrack.ts
  const setCookie = res.headers.get("set-cookie") ?? "";
  const jsession = setCookie.split(";")[0];
  if (!jsession.toUpperCase().startsWith("JSESSIONID")) {
    fail(`No JSESSIONID cookie. Raw set-cookie starts: "${setCookie.slice(0, 60)}"`);
  }
  console.log("✓ Login OK, session cookie parsed");
  return jsession;
}

async function getDevices(cookie) {
  const res = await fetch(`${BASE}/api/devices`, {
    headers: { Accept: "application/json", Cookie: cookie },
  });
  if (!res.ok) fail(`/api/devices failed: ${res.status}`);
  return res.json();
}

async function getSummary(cookie, deviceId, fromISO, toISO, daily) {
  const params = new URLSearchParams({ from: fromISO, to: toISO });
  params.append("deviceId", String(deviceId));
  if (daily) params.append("daily", "true");
  const res = await fetch(`${BASE}/api/reports/summary?${params.toString()}`, {
    headers: { Accept: "application/json", Cookie: cookie },
  });
  if (!res.ok) fail(`/api/reports/summary failed: ${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

async function main() {
  console.log(`Base URL: ${BASE}\n`);
  const cookie = await login();

  const devices = await getDevices(cookie);
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

  // Test summary on the first device, last 7 days, daily breakdown
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 86400000);
  const dev = devices[0];
  console.log(`\n• Summary for device ${dev.id} (${dev.name ?? "—"}), last 7 days, daily=true ...`);
  const rows = await getSummary(cookie, dev.id, from.toISOString(), now.toISOString(), true);
  console.log(`✓ Summary rows: ${rows.length}`);
  let totalKm = 0;
  for (const r of rows) {
    const km = (r.distance ?? 0) / 1000;
    totalKm += km;
    console.log(`   ${(r.startTime ?? "").slice(0, 10)}  ${km.toFixed(1)} km  (spentFuel: ${r.spentFuel ?? "—"})`);
  }
  console.log(`\n✓ 7-day total distance for device ${dev.id}: ${totalKm.toFixed(1)} km`);
  console.log("\n✅ Millitrack integration verified end-to-end.");
}

main().catch((e) => fail(e.message));
