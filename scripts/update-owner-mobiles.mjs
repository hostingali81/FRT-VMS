// One-off backfill: set vehicles.owner_mobile from an owner_name → mobile list
// (provided from the Vehicles master sheet). Matching is case/space-insensitive
// so "RAKESH Kumar" in the sheet matches "Rakesh Kumar" in the DB. Owners with no
// number in the sheet (IMPERIAL, XYZ(Sujeet Yadav), etc.) are left untouched.
//
// Usage:
//   node --env-file=.env.local scripts/update-owner-mobiles.mjs          # DRY RUN (no writes)
//   node --env-file=.env.local scripts/update-owner-mobiles.mjs --apply  # write changes
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local).");
  process.exit(1);
}

// owner_name (as in the sheet) → 10-digit mobile. Repeated owners share one number.
const OWNER_MOBILES = [
  ["Chandra Shekhar", "9936149688"],
  ["Vivek", "8382969294"],
  ["Rohit Verma", "7905384830"],
  ["RAKESH Kumar", "9936581980"],
  ["AMAN Yadav", "9450158805"],
  ["Katiyar ji", "9889519975"],
  ["SHIVENDRA KUMAR", "7266860692"],
  ["Shashank Desh Pandey", "8808212082"],
  ["Puneet Kumar", "9919573107"],
  ["Rajesh Tiwari", "7905036310"],
  ["Abhishek Singh", "9648153283"],
  ["ADV", "9450158805"],
  ["Kamlesh Kumar", "8115472264"],
  ["Mainuddeen", "8303724055"],
  ["Arjun Lal", "9005927542"],
  ["Vimlesh Kumar", "8423540675"],
  ["Dilip Kumar", "8960570075"],
  ["Subhas Gautam", "8468046368"],
  ["Vimal Kumar", "9651507902"],
];

const norm = (s) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const mobileByName = new Map(); // normalized name -> { mobile, display }
for (const [name, mobile] of OWNER_MOBILES) {
  mobileByName.set(norm(name), { mobile, display: name });
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: vehicles, error } = await supabase
  .from("vehicles")
  .select("id, registration_no, owner_name, owner_mobile")
  .order("registration_no");

if (error) {
  console.error("Failed to load vehicles:", error.message);
  process.exit(1);
}

console.log(`\nLoaded ${vehicles.length} vehicles. Mode: ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}\n`);

// 1) Distinct DB owner names — so we can eyeball any spelling mismatch vs the sheet.
const dbNames = new Map(); // normalized -> { display, count }
for (const v of vehicles) {
  const key = norm(v.owner_name);
  if (!dbNames.has(key)) dbNames.set(key, { display: v.owner_name ?? "(blank)", count: 0 });
  dbNames.get(key).count += 1;
}
console.log("── Distinct owner_name values in DB ──");
for (const { display, count } of [...dbNames.values()].sort((a, b) => b.count - a.count)) {
  const matched = mobileByName.has(norm(display)) ? "✓ in list" : "  —";
  console.log(`  ${String(count).padStart(2)}×  ${display.padEnd(28)} ${matched}`);
}

// 2) Plan the updates.
const updates = [];
const alreadyCorrect = [];
const matchedKeys = new Set();
for (const v of vehicles) {
  const hit = mobileByName.get(norm(v.owner_name));
  if (!hit) continue;
  matchedKeys.add(norm(v.owner_name));
  if ((v.owner_mobile ?? "") === hit.mobile) {
    alreadyCorrect.push(v);
  } else {
    updates.push({ ...v, newMobile: hit.mobile });
  }
}

console.log(`\n── Planned changes: ${updates.length}  |  already correct: ${alreadyCorrect.length} ──`);
for (const u of updates) {
  console.log(`  ${u.registration_no.padEnd(12)} ${(u.owner_name ?? "").padEnd(24)} ${String(u.owner_mobile ?? "∅").padEnd(12)} → ${u.newMobile}`);
}

// 3) List names from the sheet that matched NO vehicle (likely a spelling mismatch).
const unmatched = [...mobileByName.entries()].filter(([k]) => !matchedKeys.has(k));
if (unmatched.length) {
  console.log(`\n⚠️  ${unmatched.length} name(s) from the list matched 0 vehicles — check spelling:`);
  for (const [, { display, mobile }] of unmatched) console.log(`    ${display}  (${mobile})`);
}

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to write these changes.\n");
} else {
  // 4) Apply.
  let ok = 0;
  let failed = 0;
  for (const u of updates) {
    const { error: upErr } = await supabase.from("vehicles").update({ owner_mobile: u.newMobile }).eq("id", u.id);
    if (upErr) {
      console.error(`  ✗ ${u.registration_no}: ${upErr.message}`);
      failed += 1;
    } else {
      ok += 1;
    }
  }
  console.log(`\nDone. Updated ${ok}, failed ${failed}.\n`);
  if (failed) process.exitCode = 1;
}

// Let the event loop drain on its own (supabase-js keeps a fetch agent alive).
// Calling process.exit() here triggers an intermittent libuv assertion on Windows.
