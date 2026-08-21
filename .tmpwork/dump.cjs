const XLSX = require('xlsx');
const wb = XLSX.readFile('barabanki-august-month-expenses.xlsx');
console.log('SHEETS:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  console.log('=== SHEET:', name, 'range:', ws['!ref']);
  const rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:null});
  rows.forEach((r,i)=>console.log(i, JSON.stringify(r)));
}
