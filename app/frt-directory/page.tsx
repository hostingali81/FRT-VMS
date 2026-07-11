import { PrintToolbar } from "@/components/frt-directory/PrintToolbar";
import { requireProfile } from "@/lib/auth";
import { getVehicles } from "@/lib/data";
import { buildDirectoryPages, buildRegByFrt } from "@/lib/frt-directory";

export const dynamic = "force-dynamic";

// Printable FRT directory — one page per division, a faithful copy of the paper
// sheet: Sr. No | Division | Sub Division | Sub Station | FRT Van | Vehicle Number
// | FRT Mobile No. FRT/substation/mobile are fixed; only the vehicle number is
// mapped live from the DB by FRT number. The Excel export (/frt-directory/export)
// is built from the same data so PDF and spreadsheet match.

const styles = `
  .frt-doc { font-family: Arial, Helvetica, sans-serif; color: #000; }
  .frt-table { border-collapse: collapse; width: 100%; table-layout: fixed; border: 2.5px solid #000; }
  .frt-table th, .frt-table td { border: 1.5px solid #000; padding: 14px 12px; vertical-align: middle; overflow-wrap: break-word; word-break: break-word; }
  .frt-table th {
    font-weight: 800;
    text-align: center;
    font-size: 19px;
    line-height: 1.15;
    background: #ffe100; /* yellow header — prints as light grey in B&W, black text stays readable */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .frt-table td { text-align: center; font-size: 19px; font-weight: 600; }
  .frt-table td.frt-left { text-align: left; }
  .frt-inc { line-height: 1.25; font-weight: 700; }
  .frt-inc .frt-inc-div { font-weight: 800; font-size: 17px; }
  @media print {
    /* Force A4 landscape (explicit 297×210mm) with a minimal 5mm margin. */
    @page { size: 297mm 210mm landscape; margin: 5mm; }
    html, body {
      width: 297mm;
      background: #fff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print { display: none !important; }
    /* Every division = exactly one A4 page (never split across pages). */
    .frt-page {
      break-before: page; page-break-before: always;
      break-inside: avoid; page-break-inside: avoid;
      box-shadow: none !important; border: 0 !important; padding: 0 !important; margin: 0 !important;
    }
    .frt-page:first-of-type { break-before: auto; page-break-before: avoid; }
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

          return (
            <section key={page.division} className="frt-page rounded-lg bg-white p-4 shadow-sm sm:p-5">
              <table className="frt-table">
                <colgroup>
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "18%" }} />
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
                        <td className="frt-left">{row.subStation}</td>
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
