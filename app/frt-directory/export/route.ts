import { requireProfile } from "@/lib/auth";
import { getVehicles } from "@/lib/data";
import { buildDirectoryPages, buildRegByFrt } from "@/lib/frt-directory";
import { buildFrtWorkbook } from "@/lib/frt-excel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Streams the FRT directory as an .xlsx (built with ExcelJS, styled + A4-landscape
// print-ready). Available to every signed-in role, same data as the printable page.
export async function GET() {
  await requireProfile();

  const vehicles = await getVehicles();
  const pages = buildDirectoryPages(buildRegByFrt(vehicles));
  const buffer = await buildFrtWorkbook(pages);

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="FRT-Directory.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
