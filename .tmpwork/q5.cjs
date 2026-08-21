const fs = require('fs');
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const DIV = '1ac4afe2-9c4d-4780-8012-54473b389fd9';
(async () => {
  const { data: vv } = await sb.from('vehicle_current_view').select('vehicle_id,registration_no,frt_no').eq('division_id', DIV);
  const ids = vv.map(v=>v.vehicle_id);
  const byId = new Map(vv.map(v=>[v.vehicle_id,v]));
  const { data: logs } = await sb.from('vehicle_fuel_logs').select('*').in('vehicle_id', ids).order('log_date');
  console.log('ALL-TIME logs for EDD-BARABANKI vehicles:', logs.length);
  const rates = {};
  for (const l of logs) {
    if (!l.fuel_amount || !l.fuel_litres) continue;
    const r = (l.fuel_amount / l.fuel_litres);
    const t = l.fuel_type || 'NULL';
    (rates[t] = rates[t] || []).push({d:l.log_date, amt:l.fuel_amount, lit:l.fuel_litres, r:+r.toFixed(3)});
  }
  for (const [t,arr] of Object.entries(rates)) {
    const rs = arr.map(a=>a.r).sort((a,b)=>a-b);
    console.log(`\n--- ${t} (n=${arr.length}) min=${rs[0]} med=${rs[Math.floor(rs.length/2)]} max=${rs[rs.length-1]}`);
    const hist = {};
    arr.forEach(a=>{ const k=a.r.toFixed(1); hist[k]=(hist[k]||0)+1; });
    console.log('  rate histogram:', JSON.stringify(hist));
    // recent 15
    arr.slice(-15).forEach(a=>console.log('   ', a.d, 'Rs'+a.amt, '/', a.lit+'L', '=', a.r));
  }
  // month spread
  const months = {};
  logs.forEach(l=>{const m=l.log_date.slice(0,7); months[m]=(months[m]||0)+1;});
  console.log('\n=== logs per month ==='); Object.entries(months).sort().forEach(([k,v])=>console.log(k,v));
})();
