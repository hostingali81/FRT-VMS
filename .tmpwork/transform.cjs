const XLSX = require('xlsx');
const fs = require('fs');

const VEH = {
  'FRT-1': { id:'aef28eef-45ed-4ead-ac66-1ceaf0577016', reg:'UP41CT6926', ss:'OBRI (OLD)' },
  'FRT-2': { id:'931ebc66-df8b-4e92-aec7-3e13598bcaef', reg:'UP41CT6935', ss:'OBRI (NEW)' },
  'FRT-3': { id:'58111b93-85ba-467f-8c82-3e824688abd4', reg:'UP41CT6929', ss:'J.P NAGAR' },
  'FRT-4': { id:'f275f0da-aa14-4af9-b1c7-a238902e83c8', reg:'UP41CT6933', ss:'PALHARI OLD' },
  'FRT-5': { id:'8199635b-b726-426d-93d3-052bf40f7f78', reg:'UP41CT6934', ss:'PALHARI NEW' },
  'FRT-6': { id:'709c764c-49e1-4024-8327-4069d4c3c79c', reg:'UP41CT6931', ss:'BADEL' },
};
const RATE = { CNG: 100.0, Petrol: 102.041 };
const PETROL_SPLIT = 200;

const wb = XLSX.readFile('barabanki-august-month-expenses.xlsx');
const ws = wb.Sheets['Sheet1'];
const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:null });

const serialToISO = (n) => new Date(Date.UTC(1899,11,30) + n*86400000).toISOString().slice(0,10);

const out = [];
const problems = [];
let sheetTotal = 0;

for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r[0] == null) continue;
  const sno = r[0];
  const rawDate = r[1];
  const desc = String(r[2] ?? '').trim().toUpperCase();
  const frtRaw = String(r[3] ?? '').trim().toUpperCase().replace(/\s+/g,'');
  const amount = Number(r[4]);
  const remark = String(r[5] ?? '').trim();

  if (typeof rawDate !== 'number') { problems.push(`row ${i} S.NO ${sno}: date not a serial -> ${rawDate}`); continue; }
  const date = serialToISO(rawDate);
  const v = VEH[frtRaw];
  if (!v) { problems.push(`row ${i} S.NO ${sno}: unknown FRT "${r[3]}"`); continue; }
  if (!Number.isFinite(amount) || amount <= 0) { problems.push(`row ${i} S.NO ${sno}: bad amount ${r[4]}`); continue; }
  sheetTotal += amount;

  // remark vs mapped substation sanity (informational)
  const norm = (s)=>s.toUpperCase().replace(/[^A-Z]/g,'');
  const remarkOk = norm(remark) === norm(v.ss);

  let parts;
  if (desc === 'CNG')            parts = [['CNG', amount]];
  else if (desc === 'PETROL')    parts = [['Petrol', amount]];
  else if (desc === 'PETROL+CNG' || desc === 'CNG+PETROL') {
    if (amount <= PETROL_SPLIT) { problems.push(`row ${i} S.NO ${sno}: PETROL+CNG amount ${amount} <= ${PETROL_SPLIT}`); continue; }
    parts = [['Petrol', PETROL_SPLIT], ['CNG', amount - PETROL_SPLIT]];
  } else { problems.push(`row ${i} S.NO ${sno}: unknown DESCRIPTION "${r[2]}"`); continue; }

  for (const [ftype, amt] of parts) {
    const litres = Math.round((amt / RATE[ftype]) * 100) / 100;
    if (!(litres > 0)) { problems.push(`row ${i} S.NO ${sno}: litres <= 0`); continue; }
    out.push({ sno, date, frt: frtRaw, vehicle_id: v.id, reg: v.reg, ss: v.ss, remark, remarkOk,
               fuel_type: ftype, fuel_litres: litres, fuel_amount: amt, srcDesc: desc, srcAmount: amount });
  }
}

fs.writeFileSync('.tmpwork/entries.json', JSON.stringify(out, null, 2));

console.log('sheet data rows parsed :', rows.length - 1);
console.log('entries produced       :', out.length);
console.log('sheet total amount  Rs :', sheetTotal);
console.log('entries total amount Rs:', out.reduce((s,e)=>s+e.fuel_amount,0));
console.log('date range             :', out.map(e=>e.date).sort()[0], '->', out.map(e=>e.date).sort().slice(-1)[0]);
console.log('\nPROBLEMS:', problems.length); problems.forEach(p=>console.log('  !', p));
console.log('\nremark/substation mismatches:');
out.filter(e=>!e.remarkOk).forEach(e=>console.log(`  S.NO ${e.sno} ${e.date} ${e.frt} remark="${e.remark}" mapped="${e.ss}"`));

console.log('\n=== per-FRT summary ===');
const g = {};
out.forEach(e=>{ const k=e.frt+' '+e.reg; g[k]=g[k]||{n:0,amt:0,cng:0,pet:0,cngAmt:0,petAmt:0};
  g[k].n++; g[k].amt+=e.fuel_amount; if(e.fuel_type==='CNG'){g[k].cng++;g[k].cngAmt+=e.fuel_amount;}else{g[k].pet++;g[k].petAmt+=e.fuel_amount;} });
Object.entries(g).sort().forEach(([k,v])=>console.log(`  ${k}: ${v.n} entries  Rs${v.amt}  (CNG ${v.cng}/Rs${v.cngAmt}, Petrol ${v.pet}/Rs${v.petAmt})`));

console.log('\n=== rows split from PETROL+CNG ===');
out.filter(e=>e.srcDesc==='PETROL+CNG').forEach(e=>console.log(`  S.NO ${e.sno} ${e.date} ${e.frt} src Rs${e.srcAmount} -> ${e.fuel_type} Rs${e.fuel_amount} / ${e.fuel_litres}L`));

console.log('\n=== per-date counts ===');
const d={}; out.forEach(e=>d[e.date]=(d[e.date]||0)+1);
Object.entries(d).sort().forEach(([k,v])=>console.log('  ',k,v));
