const fs = require('fs');
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const DIV = '1ac4afe2-9c4d-4780-8012-54473b389fd9';
(async () => {
  const { data: vv } = await sb.from('vehicle_current_view').select('vehicle_id,registration_no,frt_no,substation,fuel_type,fuel_ownership,status').eq('division_id', DIV);
  const byId = new Map(vv.map(v=>[v.vehicle_id,v]));

  const { data: logs, error } = await sb.from('vehicle_fuel_logs').select('*')
    .gte('log_date','2026-08-01').lte('log_date','2026-08-31').order('log_date').order('created_at');
  if (error) return console.error(error);
  console.log('TOTAL AUG LOGS (all divisions):', logs.length);

  const byRec = {};
  for (const l of logs) { const k = (l.recorded_by??'NULL') + ' | inDiv=' + (byId.has(l.vehicle_id)?'Y':'N'); byRec[k]=(byRec[k]||0)+1; }
  console.log('=== recorded_by breakdown (Aug, all) ===');
  Object.entries(byRec).sort().forEach(([k,v])=>console.log(v.toString().padStart(4), k));

  const divLogs = logs.filter(l=>byId.has(l.vehicle_id));
  console.log('\n=== AUG LOGS in EDD-BARABANKI:', divLogs.length, '===');
  for (const l of divLogs) {
    const v = byId.get(l.vehicle_id);
    console.log([l.log_date, (v.frt_no||'').padEnd(6), v.registration_no, (l.fuel_type||'-').padEnd(7), 'L='+l.fuel_litres, 'Rs='+l.fuel_amount, 'km='+l.gps_distance_km, 'by='+l.recorded_by, 'at='+(l.logged_at||'-'), 'notes='+(l.notes||''), l.id].join(' | '));
  }
})();
