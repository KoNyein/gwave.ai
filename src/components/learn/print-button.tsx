"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Opens the browser print dialog so the certificate can be saved as PDF. */
export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Download className="mr-1.5 h-4 w-4" /> PDF ရယူ / Print
    </Button>
  );
}
