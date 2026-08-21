const fs = require('fs');
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const DIV = '1ac4afe2-9c4d-4780-8012-54473b389fd9';
(async () => {
  const { data: vv } = await sb.from('vehicle_current_view').select('vehicle_id,registration_no,frt_no').eq('division_id', DIV);
  const ids = new Set(vv.map(v=>v.vehicle_id));
  // Full August snapshot across ALL divisions, so we can prove non-target rows survive.
  const { data: all, error } = await sb.from('vehicle_fuel_logs').select('*')
    .gte('log_date','2026-08-01').lte('log_date','2026-08-31');
  if (error) throw error;
  const target = all.filter(l => l.recorded_by === 'Aditya Kumar Yadav' && ids.has(l.vehicle_id));
  const others = all.filter(l => !(l.recorded_by === 'Aditya Kumar Yadav' && ids.has(l.vehicle_id)));
  fs.writeFileSync('.tmpwork/backup-aug-ALL.json', JSON.stringify(all,null,2));
  fs.writeFileSync('.tmpwork/backup-aug-TARGET.json', JSON.stringify(target,null,2));
  fs.writeFileSync('.tmpwork/backup-aug-OTHERS.json', JSON.stringify(others,null,2));
  console.log('August rows total :', all.length);
  console.log('TARGET (delete)   :', target.length, ' Rs', target.reduce((s,l)=>s+Number(l.fuel_amount||0),0));
  console.log('OTHERS (keep)     :', others.length);
  console.log('others recorded_by:', [...new Set(others.map(o=>o.recorded_by))].join(', '));
  console.log('backups written to .tmpwork/');
})();
