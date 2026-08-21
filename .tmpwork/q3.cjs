const fs = require('fs');
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const DIV = '1ac4afe2-9c4d-4780-8012-54473b389fd9';
(async () => {
  // vehicle_current_view for the division
  const { data: vv, error: ve } = await sb.from('vehicle_current_view').select('*').eq('division_id', DIV);
  if (ve) return console.error('view err', ve);
  console.log('=== EDD-BARABANKI VEHICLES (', vv.length, ') ===');
  for (const v of vv) console.log([v.vehicle_id, v.registration_no, v.frt_no, v.substation, v.fuel_type, v.fuel_ownership, v.status].join(' | '));
})();
