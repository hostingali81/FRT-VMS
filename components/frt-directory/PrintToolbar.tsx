"use client";

import { ArrowLeft, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/components/ui/button";

// Toolbar for the FRT directory. Both buttons are true one-click downloads served
// by their routes (PDF via headless Chrome, Excel via ExcelJS) — no print dialog.
// Hidden when printing (`no-print`).
export function PrintToolbar() {
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);

  async function download(kind: "pdf" | "excel") {
    if (busy) return;
    setBusy(kind);
    try {
      const res = await fetch(`/frt-directory/${kind === "pdf" ? "pdf" : "export"}`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = kind === "pdf" ? "FRT-Directory.pdf" : "FRT-Directory.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`${kind === "pdf" ? "PDF" : "Excel"} generate karne me dikkat aayi — dobara try karein.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3">
      <LinkButton href="/dashboard" variant="secondary">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </LinkButton>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => download("excel")} disabled={busy !== null}>
          {busy === "excel" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          )}
          Download Excel
        </Button>
        <Button onClick={() => download("pdf")} disabled={busy !== null}>
          {busy === "pdf" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileText className="h-4 w-4" aria-hidden="true" />
          )}
          Download PDF
        </Button>
      </div>
    </div>
  );
}
