"use client";

import { ArrowLeft, FileSpreadsheet, Printer } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";

// Toolbar for the printable FRT directory. Hidden when printing (`no-print`), so
// the saved PDF / printed sheet contains only the document.
//   • Download PDF   — opens the browser print dialog (user picks "Save as PDF").
//   • Download Excel — downloads the styled, A4-landscape print-ready .xlsx.
export function PrintToolbar() {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3">
      <LinkButton href="/dashboard" variant="secondary">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </LinkButton>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            window.location.href = "/frt-directory/export";
          }}
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          Download Excel
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          Download PDF
        </Button>
      </div>
    </div>
  );
}
