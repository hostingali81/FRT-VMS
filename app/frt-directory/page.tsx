import type { CSSProperties } from "react";
import { PrintToolbar } from "@/components/frt-directory/PrintToolbar";
import { requireProfile } from "@/lib/auth";
import { getVehicles } from "@/lib/data";
import { buildDirectoryPages, buildRegByFrt } from "@/lib/frt-directory";

export const dynamic = "force-dynamic";

// Printable FRT directory — one page per division, a faithful copy of the paper
// sheet: Sr. No | Division | Sub Division | Sub Station | FRT Van | Vehicle Number
// | FRT Mobile No. FRT/substation/mobile are fixed; only the vehicle number is
// mapped live from the DB by FRT number, and only for *active* vehicles. The
// Excel export (/frt-directory/export) is built from the same data so PDF and
// spreadsheet match.

const styles = `
  .frt-doc { font-family: Arial, Helvetica, sans-serif; color: #000; }
  .frt-table { border-collapse: collapse; width: 100%; table-layout: fixed; border: 2.5px solid #000; }
  /* One type size for every column (--frt-fs). 21px is the largest size that
     still fits: above it either a value breaks mid-word, or the two-line cells
     (the wrapped headers and the twin-registration row) outgrow the 62px each
     row gets on the densest page. */
  .frt-table { --frt-fs: 21px; }
  .frt-table th, .frt-table td { border: 1.5px solid #000; padding: 4px 6px; vertical-align: middle; overflow-wrap: break-word; word-break: break-word; font-size: var(--frt-fs); }
  .frt-table th {
    font-weight: 800;
    text-align: center;
    line-height: 1.15;
    background: #ffe100; /* yellow header — prints as light grey in B&W, black text stays readable */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .frt-table td { text-align: center; font-weight: 700; }
  .frt-table td.frt-sub { text-align: left; padding-left: 10px; }
  .frt-inc { line-height: 1.25; font-weight: 800; }
  .frt-inc .frt-inc-div { font-weight: 800; }
  @media print {
    /* Force A4 landscape with an equal, minimal 6mm margin on every side.
       NB: "size" takes either lengths or a page-size + orientation keyword —
       mixing them ("297mm 210mm landscape") is invalid, so Chrome drops the
       whole declaration and prints Letter portrait instead. */
    @page { size: A4 landscape; margin: 6mm; }
    html, body {
      background: #fff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print { display: none !important; }
    /* Every division = exactly one full A4 page (never split across pages). */
    .frt-page {
      break-before: page; page-break-before: always;
      break-inside: avoid; page-break-inside: avoid;
      overflow: hidden;
      box-shadow: none !important; border: 0 !important; padding: 0 !important; margin: 0 !important;
    }
    .frt-page:first-of-type { break-before: auto; page-break-before: avoid; }
    /* Fill the printable page: every row shares the page height equally (var(--rows)
       = header + data rows for this division), so the table reaches the bottom on
       EVERY division — equal margins, no leftover bottom gap. vh units track the
       real printable area, so it fills whatever the print margin ends up being.
       99.4vh keeps a hair of slack so a rounding overflow can't push a blank page. */
    .frt-table tr { height: calc(99.4vh / var(--rows, 12)); }
    .frt-table thead { display: table-header-group; }
  }
`;

export default async function FrtDirectoryPage() {
  await requireProfile();
  const vehicles = await getVehicles();
  const pages = buildDirectoryPages(buildRegByFrt(vehicles));

  return (
    <div className="frt-doc min-h-screen bg-slate-100 px-4 py-6 sm:px-6 print:bg-white print:p-0">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="mx-auto max-w-6xl space-y-6 print:max-w-none print:space-y-0">
        <PrintToolbar />

        {pages.map((page) => {
          const normalCount = page.groups.reduce((total, group) => total + group.rows.length, 0);
          // header + all body rows — drives the equal per-row height in print.
          const rowsCount = normalCount + (page.qrt ? 1 : 0) + 1;
          const tableStyle = { "--rows": rowsCount } as CSSProperties;

          return (
            <section key={page.division} className="frt-page rounded-lg bg-white p-4 shadow-sm sm:p-5">
              <table className="frt-table" style={tableStyle}>
                {/* Each column gets exactly what its widest value needs at --frt-fs
                    (measured in Chrome: "HAIDERGARH", "FRT 10", "UP78FN5416,",
                    "931-1912-667"); the leftover goes to Sub Station, 23% → 27.7%. */}
                <colgroup>
                  <col style={{ width: "4.7%" }} />
                  <col style={{ width: "16.4%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "27.7%" }} />
                  <col style={{ width: "8.3%" }} />
                  <col style={{ width: "14.1%" }} />
                  <col style={{ width: "13.8%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Sr. No</th>
                    <th>DIVISION</th>
                    <th>SUB DIVISION</th>
                    <th>SUB STATION</th>
                    <th>FRT VAN</th>
                    <th>Vehicle Number</th>
                    <th>FRT Mobile No</th>
                  </tr>
                </thead>
                <tbody>
                  {page.groups.map((group, groupIndex) =>
                    group.rows.map((row, rowIndex) => (
                      <tr key={row.frtNo}>
                        <td>{row.srNo}</td>
                        {groupIndex === 0 && rowIndex === 0 && (
                          <td rowSpan={normalCount} className="frt-inc">
                            <div className="frt-inc-div">{page.division.toUpperCase()}</div>
                          </td>
                        )}
                        {rowIndex === 0 && <td rowSpan={group.rows.length}>{group.subDivision || "—"}</td>}
                        <td className="frt-sub">{row.subStation}</td>
                        <td>{row.frtVan}</td>
                        <td>{row.vehicle}</td>
                        <td>{row.frtMobile}</td>
                      </tr>
                    )),
                  )}
                  {page.qrt && (
                    <tr>
                      <td>{page.qrt.srNo}</td>
                      <td colSpan={3}>{page.qrt.label}</td>
                      <td>{page.qrt.frtVan}</td>
                      <td>{page.qrt.vehicle}</td>
                      <td>{page.qrt.frtMobile}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
