import { requireProfile } from "@/lib/auth";
import { getVehicles } from "@/lib/data";
import { buildDirectoryPages, buildRegByFrt } from "@/lib/frt-directory";
import { renderFrtDirectoryHtml } from "@/lib/frt-html";
import { renderFrtPdf } from "@/lib/frt-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // headless Chrome cold start + render

// One-click PDF download — the FRT directory rendered by headless Chrome, so the
// A4-landscape layout / equal margins are baked in (no print dialog). Same data
// and look as the printable page and the Excel export.
export async function GET() {
  await requireProfile();

  const vehicles = await getVehicles();
  const pages = buildDirectoryPages(buildRegByFrt(vehicles));
  const html = renderFrtDirectoryHtml(pages);
  const pdf = await renderFrtPdf(html);

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="FRT-Directory.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
