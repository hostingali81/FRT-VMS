const fs = require('fs');
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const entries = JSON.parse(fs.readFileSync('.tmpwork/entries.json','utf8'));
const RECORDED_BY = 'Aditya Kumar Yadav';

// Sequential created_at (1s apart, in sheet S.NO order) so the register lists a
// day's fills in the same order the sheet does instead of an arbitrary one.
const base = Date.now() - entries.length * 1000;

const rows = entries.map((e, i) => ({
  vehicle_id: e.vehicle_id,
  log_date: e.date,
  fuel_type: e.fuel_type,
  fuel_litres: e.fuel_litres,
  fuel_amount: e.fuel_amount,
  recorded_by: RECORDED_BY,
  notes: null,
  created_at: new Date(base + i * 1000).toISOString(),
}));

(async () => {
  // Safety: the window must be empty for these vehicles before we insert.
  const vids = [...new Set(rows.map(r=>r.vehicle_id))];
  const { data: pre } = await sb.from('vehicle_fuel_logs').select('id')
    .in('vehicle_id', vids).gte('log_date','2026-07-31').lte('log_date','2026-08-31');
  if (pre.length !== 0) throw new Error(`ABORT: window not empty, ${pre.length} rows already present`);
  console.log('Window empty. Inserting', rows.length, 'rows...');

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 25) {
    const chunk = rows.slice(i, i + 25);
    const { data, error } = await sb.from('vehicle_fuel_logs').insert(chunk).select('id');
    if (error) throw error;
    inserted += data.length;
    console.log(`  chunk ${i/25 + 1}: +${data.length} (total ${inserted})`);
  }
  console.log('Inserted:', inserted);
})();
