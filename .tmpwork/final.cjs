const fs = require('fs');
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
(async () => {
  const { count } = await sb.from('vehicle_fuel_logs').select('*',{count:'exact',head:true});
  console.log('TOTAL rows in vehicle_fuel_logs now:', count);
  const { data: all } = await sb.from('vehicle_fuel_logs').select('log_date,recorded_by');
  const m={}; all.forEach(l=>{const k=l.log_date.slice(0,7); m[k]=(m[k]||0)+1;});
  console.log('per month:', JSON.stringify(m));
  const b={}; all.forEach(l=>b[l.recorded_by]=(b[l.recorded_by]||0)+1);
  console.log('per recorder:', JSON.stringify(b));
})();
