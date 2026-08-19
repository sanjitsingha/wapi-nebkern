'use client';

import { useMemo, useState } from 'react';
import { Search, Phone, MessageSquareText, Clock } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fmtDateTime } from '../_lib/format';
import { ExportCsvButton } from './export-csv';
import { EmptyState } from './ui';

export interface QrGenerationRow {
  id: string;
  phone: string;
  message: string | null;
  created_at: string;
}

/**
 * Codes generated on the public /qr-generator tool.
 *
 * Every row is someone who typed a WhatsApp number into a free tool on
 * our site — a warmer signal than a page view, and the reason the
 * generator was made public. The phone number is the whole point, so
 * it is the first column and it is what search matches on.
 */
export function QrGenerationsTable({ rows }: { rows: QrGenerationRow[] }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    // Digits-only comparison too, so "98765 43210" finds a row stored
    // as "919876543210" without the operator having to know we
    // normalize on the way in.
    const digits = needle.replace(/\D/g, '');
    return rows.filter(
      (r) =>
        (digits && r.phone.includes(digits)) ||
        (r.message ?? '').toLowerCase().includes(needle)
    );
  }, [rows, q]);

  // Nothing generated yet is a different state from "your search found
  // nothing" — only the first justifies replacing the table, since
  // there is no data to put columns over.
  if (!rows.length) {
    return (
      <div className="border-border bg-card rounded-xl border">
        <EmptyState
          title="No codes generated yet."
          description="Rows appear here when someone uses the public generator at /qr-generator."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by number or message"
            className="h-11 pl-9"
          />
        </div>
        {/* Matches the search field's height and radius — the button's
            own h-8 / rounded-sm defaults are for a toolbar on its own. */}
        <ExportCsvButton
          rows={filtered}
          filename="qr-generations"
          className="h-11 rounded-lg px-3.5"
          columns={[
            { header: 'Phone', value: (r) => r.phone },
            { header: 'Message', value: (r) => r.message },
            { header: 'Generated at', value: (r) => r.created_at },
          ]}
        />
      </div>

      <div className="border-border bg-card overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted hover:bg-muted">
              <TableHead icon={Phone} className="text-muted-foreground">
                WhatsApp number
              </TableHead>
              <TableHead
                icon={MessageSquareText}
                className="text-muted-foreground"
              >
                Pre-filled message
              </TableHead>
              <TableHead
                icon={Clock}
                className="text-muted-foreground hidden text-right sm:table-cell"
              >
                Generated
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-muted-foreground h-24 text-center text-sm"
                >
                  Nothing matches that search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className="border-border">
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    +{r.phone}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-lg">
                    {r.message ? (
                      <span className="line-clamp-2">{r.message}</span>
                    ) : (
                      // An empty message is a valid code that just opens
                      // the chat — say so rather than leave a blank cell
                      // that reads as missing data.
                      <span className="text-muted-foreground/60 italic">
                        no message — opens an empty chat
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-right text-xs whitespace-nowrap sm:table-cell">
                    {fmtDateTime(r.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
