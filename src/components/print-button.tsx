"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button
      type="button"
      className="button secondary no-print"
      onClick={() => window.print()}
    >
      <Printer size={15} /> {label}
    </button>
  );
}
