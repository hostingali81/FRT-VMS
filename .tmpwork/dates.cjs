const XLSX = require('xlsx');
const wb = XLSX.readFile('barabanki-august-month-expenses.xlsx', {cellDates:true});
const ws = wb.Sheets['Sheet1'];
const rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:null});
console.log('date1904?', wb.Workbook && wb.Workbook.WBProps ? wb.Workbook.WBProps.date1904 : 'n/a');
// raw cell inspect
for (const addr of ['B2','B3','B76']) console.log(addr, JSON.stringify(ws[addr]));
const set = new Map();
rows.slice(1).forEach(r=>{
  const d = r[1];
  const key = (d instanceof Date) ? d.toISOString().slice(0,10) : String(d);
  set.set(key,(set.get(key)||0)+1);
});
console.log('=== distinct dates (cellDates) ===');
[...set.entries()].forEach(([k,v])=>console.log(k, v));
// manual serial conversion
const ser = (n)=> new Date(Date.UTC(1899,11,30) + n*86400000).toISOString().slice(0,10);
console.log('serial 46234 ->', ser(46234), '| 46235 ->', ser(46235), '| 46254 ->', ser(46254));
console.log('sanity: 45658 ->', ser(45658), ' 44197 ->', ser(44197));
