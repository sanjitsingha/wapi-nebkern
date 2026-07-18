'use client';

import { Printer } from 'lucide-react';

/** Triggers the browser print dialog (→ Save as PDF). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
    >
      <Printer className="size-4" />
      Print / Save as PDF
    </button>
  );
}
