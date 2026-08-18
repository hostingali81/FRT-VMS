import ExcelJS from "exceljs";
import type { DirPage } from "@/lib/frt-directory";

// Builds an .xlsx that mirrors the printable FRT directory: one worksheet per
// division, yellow header, black grid, merged Division / Sub-Division / QRT cells,
// and A4-landscape print setup (fit-to-one-page, minimal margins, print area set)
// so the sheet prints identically to the PDF straight from Excel.

const HEADERS = ["Sr. No", "DIVISION", "SUB DIVISION", "SUB STATION", "FRT VAN", "Vehicle Number", "FRT Mobile No"];
// Column widths (Excel character units) mirroring the PDF column proportions —
// short columns trimmed to their content so SUB STATION gets the space.
const WIDTHS = [6, 22, 20, 37, 11, 19, 19];
const BODY_PT = 15; // one size for every cell, matching the 21px type in the PDF
const YELLOW = "FFFFE100";
const THIN = { style: "thin" as const, color: { argb: "FF000000" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function sheetName(name: string): string {
  // Excel forbids \ / ? * [ ] : in sheet names and caps them at 31 chars.
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Division";
}

function styleRow(row: ExcelJS.Row): void {
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.border = BORDER;
    if (!cell.font) cell.font = { bold: true, size: BODY_PT };
    cell.alignment = { horizontal: col === 4 ? "left" : "center", vertical: "middle", wrapText: true };
  });
}

export async function buildFrtWorkbook(pages: DirPage[]): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FRT-VMS";
  workbook.created = new Date();

  for (const page of pages) {
    const ws = workbook.addWorksheet(sheetName(page.division), {
      pageSetup: {
        paperSize: 9, // A4
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        horizontalCentered: true,
        margins: { left: 0.2, right: 0.2, top: 0.2, bottom: 0.2, header: 0, footer: 0 },
      },
    });
    ws.columns = WIDTHS.map((width) => ({ width }));

    // Fill the A4-landscape printable height (~566pt at 0.2" margins) so a sparse
    // division (e.g. Haidergarh's 8 rows) prints as a full page just like a dense
    // one — equal margins all around. Target slightly over the printable height so
    // fitToHeight:1 scales it down to fill exactly (no leftover bottom margin).
    const dataCount = page.groups.reduce((total, group) => total + group.rows.length, 0) + (page.qrt ? 1 : 0);
    const HEADER_PT = 34;
    const rowHeight = dataCount > 0 ? Math.max(24, (580 - HEADER_PT) / dataCount) : 28;

    const header = ws.addRow(HEADERS);
    header.height = HEADER_PT;
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
      cell.font = { bold: true, size: BODY_PT, color: { argb: "FF000000" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = BORDER;
    });

    const firstRow = 2;
    let r = firstRow;
    const groupRanges: Array<[number, number]> = [];
    for (const group of page.groups) {
      const start = r;
      for (const row of group.rows) {
        const xr = ws.addRow([
          row.srNo,
          page.division.toUpperCase(),
          group.subDivision,
          row.subStation,
          row.frtVan,
          row.vehicle,
          row.frtMobile,
        ]);
        xr.height = rowHeight;
        styleRow(xr);
        r += 1;
      }
      groupRanges.push([start, r - 1]);
    }
    const lastNormal = r - 1;

    // Merge the DIVISION column across all normal rows.
    if (lastNormal >= firstRow) {
      ws.mergeCells(firstRow, 2, lastNormal, 2);
      const cell = ws.getCell(firstRow, 2);
      cell.font = { bold: true, size: BODY_PT };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
    // Merge each SUB DIVISION group.
    for (const [start, end] of groupRanges) {
      if (end > start) ws.mergeCells(start, 3, end, 3);
      const cell = ws.getCell(start, 3);
      cell.font = { bold: true, size: BODY_PT };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }

    let lastUsed = lastNormal;
    if (page.qrt) {
      const xr = ws.addRow([page.qrt.srNo, page.qrt.label, null, null, page.qrt.frtVan, page.qrt.vehicle, page.qrt.frtMobile]);
      xr.height = rowHeight;
      styleRow(xr);
      const i = xr.number;
      ws.mergeCells(i, 2, i, 4); // "FRT Van For QRT Team" spans Division→Sub Station
      const cell = ws.getCell(i, 2);
      cell.font = { bold: true, size: BODY_PT };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      lastUsed = i;
    }

    ws.pageSetup.printArea = `A1:G${lastUsed}`;
  }

  return workbook.xlsx.writeBuffer();
}
