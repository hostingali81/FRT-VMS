"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";

// Toolbar for the printable FRT directory. Hidden when printing (`no-print`), so
// the saved PDF contains only the document. "Download PDF" opens the browser
// print dialog — the user picks "Save as PDF" (works on every role/device, no
// extra dependency, and keeps the table as crisp selectable text).
export function PrintToolbar() {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3">
      <LinkButton href="/dashboard" variant="secondary">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </LinkButton>
      <Button onClick={() => window.print()}>
        <Printer className="h-4 w-4" aria-hidden="true" />
        Download PDF
      </Button>
    </div>
  );
}
