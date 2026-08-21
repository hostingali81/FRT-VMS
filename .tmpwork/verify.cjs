const fs = require('fs');
const XLSX = require('xlsx');
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// --- Rebuild expectations straight from the workbook, independently of the insert script ---
const REG = { 'FRT-1':'UP41CT6926','FRT-2':'UP41CT6935','FRT-3':'UP41CT6929','FRT-4':'UP41CT6933','FRT-5':'UP41CT6934','FRT-6':'UP41CT6931' };
const RATE = { CNG:100.0, Petrol:102.041 };
const wb = XLSX.readFile('barabanki-august-month-expenses.xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header:1, raw:true, defval:null });
const ser = n => new Date(Date.UTC(1899,11,30) + n*86400000).toISOString().slice(0,10);

const expected = [];
for (let i=1;i<rows.length;i++){
  const r = rows[i]; if (!r || r[0]==null) continue;
  const date = ser(r[1]);
  const desc = String(r[2]).trim().toUpperCase();
  const frt  = String(r[3]).trim().toUpperCase().replace(/\s+/g,'');
  const amt  = Number(r[4]);
  const parts = desc==='CNG' ? [['CNG',amt]] : desc==='PETROL' ? [['Petrol',amt]] : [['Petrol',200],['CNG',amt-200]];
  for (const [t,a] of parts) expected.push({ key:[date,REG[frt],t,a].join('|'), date, reg:REG[frt], t, a, litres:Math.round(a/RATE[t]*100)/100 });
}

(async () => {
  const DIV='1ac4afe2-9c4d-4780-8012-54473b389fd9';
  const { data: vv } = await sb.from('vehicle_current_view').select('vehicle_id,registration_no,frt_no').eq('division_id', DIV);
  const regById = new Map(vv.map(v=>[v.vehicle_id, v.registration_no]));

  const { data: live, error } = await sb.from('vehicle_fuel_logs').select('*')
    .gte('log_date','2026-07-31').lte('log_date','2026-08-31').order('log_date').order('created_at');
  if (error) throw error;

  const mine = live.filter(l => regById.has(l.vehicle_id));
  const others = live.filter(l => !regById.has(l.vehicle_id));

  console.log('=== COUNTS ===');
  console.log('expected from sheet :', expected.length);
  console.log('in DB (Barabanki)   :', mine.length);
  console.log('other divisions     :', others.length, '(untouched:', [...new Set(others.map(o=>o.recorded_by))].join(', ')+')');

  // multiset compare
  const bag = k => { const m=new Map(); k.forEach(x=>m.set(x,(m.get(x)||0)+1)); return m; };
  const expBag = bag(expected.map(e=>e.key));
  const dbBag  = bag(mine.map(l=>[l.log_date, regById.get(l.vehicle_id), l.fuel_type, Number(l.fuel_amount)].join('|')));
  let diffs = 0;
  for (const [k,v] of expBag) { const d = dbBag.get(k)||0; if (d!==v){ console.log(`  MISMATCH sheet=${v} db=${d}  ${k}`); diffs++; } }
  for (const [k,v] of dbBag) { if (!expBag.has(k)){ console.log(`  EXTRA IN DB x${v}  ${k}`); diffs++; } }
  console.log('\n=== ROW-BY-ROW (date|vehicle|fuel|amount) DIFFS:', diffs, '===');

  // litres check
  let litreBad = 0;
  const expLit = new Map(); expected.forEach(e=>expLit.set(e.key, e.litres));
  for (const l of mine) {
    const k = [l.log_date, regById.get(l.vehicle_id), l.fuel_type, Number(l.fuel_amount)].join('|');
    const want = expLit.get(k);
    if (want == null) continue;
    if (Math.abs(Number(l.fuel_litres) - want) > 0.005) { console.log(`  LITRE MISMATCH ${k}: db=${l.fuel_litres} want=${want}`); litreBad++; }
  }
  console.log('LITRE DIFFS:', litreBad);

  console.log('\n=== FIELD SANITY ===');
  console.log('recorded_by values  :', JSON.stringify([...new Set(mine.map(l=>l.recorded_by))]));
  console.log('fuel_type values    :', JSON.stringify([...new Set(mine.map(l=>l.fuel_type))]));
  console.log('any null litres     :', mine.filter(l=>l.fuel_litres==null).length);
  console.log('any null amount     :', mine.filter(l=>l.fuel_amount==null).length);
  console.log('any non-positive L  :', mine.filter(l=>!(Number(l.fuel_litres)>0)).length);
  console.log('logged_at set       :', mine.filter(l=>l.logged_at).length, '(0 = date-only, sheet has no times)');
  console.log('gps_distance set    :', mine.filter(l=>l.gps_distance_km!=null).length, '(0 = needs Sync GPS Data)');
  console.log('date range          :', mine[0].log_date, '->', mine[mine.length-1].log_date);
  console.log('distinct vehicles   :', new Set(mine.map(l=>l.vehicle_id)).size);

  console.log('\n=== TOTALS ===');
  const sum = a => a.reduce((s,x)=>s+Number(x),0);
  console.log('sheet total Rs      :', sum(expected.map(e=>e.a)));
  console.log('DB total Rs         :', sum(mine.map(l=>l.fuel_amount)));
  console.log('DB total litres     :', sum(mine.map(l=>l.fuel_litres)).toFixed(2));

  console.log('\n=== PER VEHICLE ===');
  const g={};
  mine.forEach(l=>{ const r=regById.get(l.vehicle_id); g[r]=g[r]||{n:0,amt:0,lit:0};
    g[r].n++; g[r].amt+=Number(l.fuel_amount); g[r].lit+=Number(l.fuel_litres); });
  const frtBy = new Map(vv.map(v=>[v.registration_no, v.frt_no]));
  Object.entries(g).sort().forEach(([k,v])=>console.log(`  ${(frtBy.get(k)||'').padEnd(6)} ${k}: ${String(v.n).padStart(2)} entries  Rs${String(v.amt).padStart(5)}  ${v.lit.toFixed(2)} L/kg`));

  console.log('\nRESULT:', (diffs===0 && litreBad===0 && mine.length===expected.length) ? 'PERFECT MATCH ✅' : 'DISCREPANCIES FOUND ❌');
})();
