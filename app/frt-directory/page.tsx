import { PrintToolbar } from "@/components/frt-directory/PrintToolbar";
import { requireProfile } from "@/lib/auth";
import { getVehicles } from "@/lib/data";
import {
  FRT_DIRECTORY,
  type FrtDirectoryEntry,
  formatMobile,
  parseFrtNo,
} from "@/lib/frt-directory";

export const dynamic = "force-dynamic";

// Printable FRT directory — one page per division, a faithful copy of the paper
// sheet: Sr. No | Division Incharge | Sub Division | Sub Station | FRT Van |
// Vehicle Number | FRT Mobile No. FRT/substation/mobile are fixed; only the
// vehicle number is mapped live from the DB by FRT number.

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
  .frt-inc .frt-inc-name { font-weight: 600; }
  .frt-inc .frt-inc-mob { white-space: nowrap; font-weight: 600; }
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

type NormalRow = {
  entry: FrtDirectoryEntry;
  srNo: number;
  subDivision: string;
  isGroupFirst: boolean;
  groupSize: number;
};

export default async function FrtDirectoryPage() {
  await requireProfile();
  const vehicles = await getVehicles();

  // Vehicle registration(s) currently posted at each FRT number.
  const regByFrt = new Map<number, string[]>();
  for (const vehicle of vehicles) {
    if (vehicle.status === "removed") continue;
    const frt = parseFrtNo(vehicle.frt_no);
    if (frt == null) continue;
    const reg = vehicle.registration_no.replace(/\s+/g, "").toUpperCase();
    const list = regByFrt.get(frt) ?? [];
    list.push(reg);
    regByFrt.set(frt, list);
  }
  const vehicleFor = (frt: number) => (regByFrt.get(frt) ?? []).join(", ") || "—";

  // Group the fixed directory by division, preserving FRT order.
  const order: string[] = [];
  const byDivision = new Map<string, FrtDirectoryEntry[]>();
  for (const entry of FRT_DIRECTORY) {
    if (!byDivision.has(entry.division)) {
      byDivision.set(entry.division, []);
      order.push(entry.division);
    }
    byDivision.get(entry.division)!.push(entry);
  }

  return (
    <div className="frt-doc min-h-screen bg-slate-100 px-4 py-6 sm:px-6 print:bg-white print:p-0">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="mx-auto max-w-6xl space-y-6 print:max-w-none print:space-y-0">
        <PrintToolbar />

        {order.map((division) => {
          const entries = byDivision.get(division)!;
          const qrtEntry = entries.find((entry) => entry.qrt);
          const normals = entries.filter((entry) => !entry.qrt);

          // Consecutive sub-division groups among the normal rows.
          const groups: { sub: string; rows: FrtDirectoryEntry[] }[] = [];
          for (const entry of normals) {
            const key = entry.subDivision ?? "";
            const last = groups[groups.length - 1];
            if (last && last.sub === key) last.rows.push(entry);
            else groups.push({ sub: key, rows: [entry] });
          }
          const showSub = groups.some((group) => group.sub !== "");

          let sr = 0;
          const rows: NormalRow[] = groups.flatMap((group) =>
            group.rows.map((entry, index) => {
              sr += 1;
              return {
                entry,
                srNo: sr,
                subDivision: group.sub,
                isGroupFirst: index === 0,
                groupSize: group.rows.length,
              };
            }),
          );

          return (
            <section key={division} className="frt-page rounded-lg bg-white p-4 shadow-sm sm:p-5">
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
                  {rows.map((row, index) => (
                    <tr key={row.entry.frtNo}>
                      <td>{row.srNo}</td>
                      {index === 0 && (
                        <td rowSpan={rows.length} className="frt-inc">
                          <div className="frt-inc-div">{division.toUpperCase()}</div>
                        </td>
                      )}
                      {showSub
                        ? row.isGroupFirst && (
                            <td rowSpan={row.groupSize}>{row.subDivision || "—"}</td>
                          )
                        : index === 0 && <td rowSpan={rows.length} />}
                      <td className="frt-left">{row.entry.substation}</td>
                      <td>FRT {row.entry.frtNo}</td>
                      <td>{vehicleFor(row.entry.frtNo)}</td>
                      <td>{formatMobile(row.entry.mobile)}</td>
                    </tr>
                  ))}
                  {qrtEntry && (
                    <tr>
                      <td>{qrtEntry.frtNo}</td>
                      <td colSpan={3}>{qrtEntry.substation}</td>
                      <td>FRT {qrtEntry.frtNo}</td>
                      <td>{vehicleFor(qrtEntry.frtNo)}</td>
                      <td>{formatMobile(qrtEntry.mobile)}</td>
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
