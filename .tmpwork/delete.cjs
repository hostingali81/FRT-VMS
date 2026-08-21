const fs = require('fs');
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const target = JSON.parse(fs.readFileSync('.tmpwork/backup-aug-TARGET.json','utf8'));
const ids = target.map(t => t.id);

(async () => {
  // Re-verify the exact rows still exist and still look like the backup.
  const { data: live, error: le } = await sb.from('vehicle_fuel_logs').select('*').in('id', ids);
  if (le) throw le;
  if (live.length !== ids.length) throw new Error(`ABORT: expected ${ids.length} live rows, found ${live.length}`);
  const liveById = new Map(live.map(r=>[r.id,r]));
  for (const b of target) {
    const l = liveById.get(b.id);
    if (!l) throw new Error('ABORT: missing ' + b.id);
    if (l.log_date !== b.log_date || String(l.fuel_amount) !== String(b.fuel_amount) || l.recorded_by !== b.recorded_by)
      throw new Error('ABORT: row changed since backup: ' + b.id);
  }
  // Guard: every target row must be recorded_by Aditya and dated in August 2026.
  for (const l of live) {
    if (l.recorded_by !== 'Aditya Kumar Yadav') throw new Error('ABORT: non-Aditya row in target: ' + l.id);
    if (!l.log_date.startsWith('2026-08')) throw new Error('ABORT: non-August row in target: ' + l.id);
  }
  console.log('Pre-flight OK:', live.length, 'rows verified against backup.');

  const { error: de } = await sb.from('vehicle_fuel_logs').delete().in('id', ids);
  if (de) throw de;

  // Verify
  const { data: after } = await sb.from('vehicle_fuel_logs').select('id').in('id', ids);
  console.log('Deleted. Rows from target list still present:', after.length, '(expected 0)');

  const { data: aug } = await sb.from('vehicle_fuel_logs').select('id,recorded_by')
    .gte('log_date','2026-08-01').lte('log_date','2026-08-31');
  console.log('August rows remaining (all divisions):', aug.length, '(expected 28)');
  const by = {}; aug.forEach(a=>by[a.recorded_by]=(by[a.recorded_by]||0)+1);
  console.log('remaining by:', JSON.stringify(by));

  const { data: jun } = await sb.from('vehicle_fuel_logs').select('id').gte('log_date','2026-06-01').lte('log_date','2026-06-30');
  console.log('June rows untouched:', jun.length, '(expected 23 for Barabanki vehicles + any others)');
})();
