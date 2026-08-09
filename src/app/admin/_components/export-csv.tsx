'use client';

import { Download } from 'lucide-react';

// ============================================================
// Export what is on screen.
//
// Every list in the panel is a thing someone eventually wants in a
// spreadsheet — the subscriber list to hand to an email tool, accounts
// to reconcile against payments, enquiries to chase. Until now that
// meant selecting the table and hoping the paste survived.
//
// Costs nothing: the rows are already rendered, so this serialises
// what the component holds and hands the browser a Blob. No request,
// no server round trip, and it exports the FILTERED view — what you
// are looking at is what you get, which is almost always what you
// meant.
// ============================================================

/**
 * RFC 4180 quoting. A quote inside a field is doubled, and any field
 * containing a comma, quote or newline is wrapped — skip this and one
 * company name with a comma in it silently shifts every later column.
 */
function cell(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv<T>(
  rows: T[],
  columns: { header: string; value: (row: T) => unknown }[]
): string {
  const head = columns.map((c) => cell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(','));
  return [head, ...body].join('\r\n');
}

export function ExportCsvButton<T>({
  rows,
  columns,
  filename,
  label = 'Export',
}: {
  rows: T[];
  columns: { header: string; value: (row: T) => unknown }[];
  /** Without extension — the date is appended. */
  filename: string;
  label?: string;
}) {
  const download = () => {
    const csv = toCsv(rows, columns);
    // The BOM is what makes Excel read this as UTF-8 rather than the
    // system codepage; without it every accented name arrives mojibake.
    const blob = new Blob(['﻿', csv], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm border border-(--admin-line) px-2.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40"
    >
      <Download className="size-3.5" />
      {label}
      <span className="admin-num text-muted-foreground/70">
        ({rows.length})
      </span>
    </button>
  );
}
