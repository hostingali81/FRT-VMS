import type { DirPage } from "@/lib/frt-directory";

// Standalone HTML document for the headless-Chrome PDF (/frt-directory/pdf).
// Mirrors the on-screen table, but sizes every row in exact mm so each division
// fills one A4-landscape page (printable height ≈ 198mm at 6mm margins; 197mm
// leaves a hair of slack). This is deterministic in Chrome's page.pdf, which does
// not resolve `vh` against the paper the way screen print does.

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .frt-page { page-break-before: always; overflow: hidden; }
  .frt-page:first-child { page-break-before: avoid; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; border: 2.5px solid #000; }
  /* One type size for every column — the largest that keeps every value on a
     single line at the widths below and still fits two-line cells in one row. */
  table { --frt-fs: 21px; }
  th, td { border: 1.5px solid #000; padding: 2px 6px; vertical-align: middle;
    overflow-wrap: break-word; word-break: break-word; text-align: center; font-size: var(--frt-fs); }
  th { font-weight: 800; background: #ffe100; line-height: 1.15; }
  td { font-weight: 700; }
  td.sub { text-align: left; padding-left: 10px; }
  .inc { font-weight: 800; }
  /* Every row shares the printable page height equally → table fills the page. */
  tr { height: calc(197mm / var(--rows, 12)); }
`;

// Each column gets exactly what its widest value needs at --frt-fs, so Sub Station
// takes the rest — must stay in sync with app/frt-directory/page.tsx.
const COLGROUP = `<colgroup>
  <col style="width:4.7%"><col style="width:16.4%"><col style="width:15%"><col style="width:27.7%">
  <col style="width:8.3%"><col style="width:14.1%"><col style="width:13.8%">
</colgroup>`;

const HEAD = `<thead><tr>
  <th>Sr. No</th><th>DIVISION</th><th>SUB DIVISION</th><th>SUB STATION</th>
  <th>FRT VAN</th><th>Vehicle Number</th><th>FRT Mobile No</th>
</tr></thead>`;

function pageTable(page: DirPage): string {
  const normalCount = page.groups.reduce((total, group) => total + group.rows.length, 0);
  const rowsCount = normalCount + (page.qrt ? 1 : 0) + 1; // + header

  const body: string[] = [];
  let groupIndex = 0;
  for (const group of page.groups) {
    let rowIndex = 0;
    for (const row of group.rows) {
      const cells: string[] = [`<td>${row.srNo}</td>`];
      if (groupIndex === 0 && rowIndex === 0) {
        cells.push(`<td class="inc" rowspan="${normalCount}">${esc(page.division.toUpperCase())}</td>`);
      }
      if (rowIndex === 0) {
        cells.push(`<td rowspan="${group.rows.length}">${esc(group.subDivision || "—")}</td>`);
      }
      cells.push(`<td class="sub">${esc(row.subStation)}</td>`);
      cells.push(`<td>${esc(row.frtVan)}</td>`);
      cells.push(`<td>${esc(row.vehicle)}</td>`);
      cells.push(`<td>${esc(row.frtMobile)}</td>`);
      body.push(`<tr>${cells.join("")}</tr>`);
      rowIndex += 1;
    }
    groupIndex += 1;
  }

  if (page.qrt) {
    body.push(
      `<tr><td>${page.qrt.srNo}</td>` +
        `<td colspan="3">${esc(page.qrt.label)}</td>` +
        `<td>${esc(page.qrt.frtVan)}</td>` +
        `<td>${esc(page.qrt.vehicle)}</td>` +
        `<td>${esc(page.qrt.frtMobile)}</td></tr>`,
    );
  }

  return `<section class="frt-page"><table style="--rows:${rowsCount}">${COLGROUP}${HEAD}<tbody>${body.join("")}</tbody></table></section>`;
}

export function renderFrtDirectoryHtml(pages: DirPage[]): string {
  const sections = pages.map(pageTable).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${sections}</body></html>`;
}
