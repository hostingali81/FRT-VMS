import ExcelJS from "exceljs";
import fs from "node:fs";

const HEADERS = ["Sr. No","DIVISION","SUB DIVISION","SUB STATION","FRT VAN","Vehicle Number","FRT Mobile No"];
const WIDTHS = [7,22,20,28,12,24,24];
const YELLOW = "FFFFE100";
const THIN = { style:"thin", color:{argb:"FF000000"} };
const BORDER = { top:THIN,left:THIN,bottom:THIN,right:THIN };
function styleRow(row){ row.eachCell({includeEmpty:true},(cell,col)=>{ cell.border=BORDER; if(!cell.font)cell.font={size:13}; cell.alignment={horizontal:col===4?"left":"center",vertical:"middle",wrapText:true}; }); }

async function build(pages){
  const wb = new ExcelJS.Workbook();
  for(const page of pages){
    const ws = wb.addWorksheet(page.division.slice(0,31), { pageSetup:{ paperSize:9, orientation:"landscape", fitToPage:true, fitToWidth:1, fitToHeight:1, horizontalCentered:true, margins:{left:0.2,right:0.2,top:0.2,bottom:0.2,header:0,footer:0} } });
    ws.columns = WIDTHS.map(width=>({width}));
    const header = ws.addRow(HEADERS); header.height=34;
    header.eachCell(c=>{ c.fill={type:"pattern",pattern:"solid",fgColor:{argb:YELLOW}}; c.font={bold:true,size:13}; c.alignment={horizontal:"center",vertical:"middle",wrapText:true}; c.border=BORDER; });
    const firstRow=2; let r=firstRow; const ranges=[];
    for(const g of page.groups){ const start=r; for(const row of g.rows){ const xr=ws.addRow([row.srNo,page.division.toUpperCase(),g.subDivision,row.subStation,row.frtVan,row.vehicle,row.frtMobile]); xr.height=28; styleRow(xr); r++; } ranges.push([start,r-1]); }
    const lastNormal=r-1;
    if(lastNormal>=firstRow){ ws.mergeCells(firstRow,2,lastNormal,2); const c=ws.getCell(firstRow,2); c.font={bold:true,size:14}; c.alignment={horizontal:"center",vertical:"middle",wrapText:true}; }
    for(const [s,e] of ranges){ if(e>s) ws.mergeCells(s,3,e,3); const c=ws.getCell(s,3); c.font={size:13}; c.alignment={horizontal:"center",vertical:"middle",wrapText:true}; }
    let lastUsed=lastNormal;
    if(page.qrt){ const xr=ws.addRow([page.qrt.srNo,page.qrt.label,null,null,page.qrt.frtVan,page.qrt.vehicle,page.qrt.frtMobile]); xr.height=28; styleRow(xr); const i=xr.number; ws.mergeCells(i,2,i,4); const c=ws.getCell(i,2); c.alignment={horizontal:"center",vertical:"middle",wrapText:true}; lastUsed=i; }
    ws.pageSetup.printArea = `A1:G${lastUsed}`;
  }
  return wb;
}

const pages = [
  { division:"Barabanki", groups:[ {subDivision:"BARABANKI (I)", rows:[{frtNo:1,srNo:1,subStation:"OBARI",frtVan:"FRT 1",vehicle:"—",frtMobile:"931-1912-667"},{frtNo:2,srNo:2,subStation:"OBARI NEW",frtVan:"FRT 2",vehicle:"UP41CT6303",frtMobile:"931-1912-668"}]}, {subDivision:"BARABANKI (II)", rows:[{frtNo:4,srNo:3,subStation:"PALHARI OLD",frtVan:"FRT 4",vehicle:"—",frtMobile:"931-1912-670"}]} ] },
  { division:"Ram Sanehighat", groups:[ {subDivision:"RAM SANEHIGHAT", rows:[{frtNo:40,srNo:1,subStation:"RAM SANEHIGHAT",frtVan:"FRT 40",vehicle:"UP41AT7675",frtMobile:"931-1912-706"}]} ], qrt:{frtNo:50,srNo:50,label:"FRT Van For QRT Team",frtVan:"FRT 50",vehicle:"UP41CT6936",frtMobile:"931-1912-716"} },
];

const out = "tmp-FRT-Directory-test.xlsx";
const wb = await build(pages);
await wb.xlsx.writeFile(out);

const rb = new ExcelJS.Workbook();
await rb.xlsx.readFile(out);
console.log("sheets:", rb.worksheets.map(w=>w.name).join(", "));
const ss = rb.getWorksheet("Ram Sanehighat");
console.log("Ramsanehighat pageSetup:", JSON.stringify({paper:ss.pageSetup.paperSize, orient:ss.pageSetup.orientation, fitToPage:ss.pageSetup.fitToPage, fitW:ss.pageSetup.fitToWidth, fitH:ss.pageSetup.fitToHeight, printArea:ss.pageSetup.printArea}));
console.log("Ramsanehighat merges:", ss.model.merges);
const hdr = ss.getRow(1).getCell(1);
console.log("header fill argb:", hdr.fill?.fgColor?.argb, "| bold:", hdr.font?.bold);
console.log("file bytes:", fs.statSync(out).size);
