'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { fmtDateTime } from '../_lib/format';
import { ExportCsvButton } from './export-csv';
import { EmptyState, TableShell, Td, Th, Tr } from './ui';

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by number or message"
            className="bg-card text-foreground focus-visible:border-primary h-9 w-full rounded-sm border border-(--admin-line) pr-3 pl-9 text-sm outline-none"
          />
        </div>
        <ExportCsvButton
          rows={filtered}
          filename="qr-generations"
          columns={[
            { header: 'Phone', value: (r) => r.phone },
            { header: 'Message', value: (r) => r.message },
            { header: 'Generated at', value: (r) => r.created_at },
          ]}
        />
      </div>

      <div className="bg-card overflow-hidden rounded-sm border border-(--admin-line)">
        {filtered.length === 0 ? (
          <EmptyState
            title={rows.length ? 'Nothing matches that search.' : 'No codes generated yet.'}
            description={
              rows.length
                ? undefined
                : 'Rows appear here when someone uses the public generator at /qr-generator.'
            }
          />
        ) : (
          <TableShell
            head={
              <tr>
                <Th>WhatsApp number</Th>
                <Th>Pre-filled message</Th>
                <Th className="text-right">Generated</Th>
              </tr>
            }
          >
            {filtered.map((r) => (
              <Tr key={r.id}>
                <Td className="font-mono text-xs whitespace-nowrap">
                  +{r.phone}
                </Td>
                <Td className="text-muted-foreground max-w-lg">
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
                </Td>
                <Td className="text-muted-foreground text-right text-xs whitespace-nowrap">
                  {fmtDateTime(r.created_at)}
                </Td>
              </Tr>
            ))}
          </TableShell>
        )}
      </div>
    </div>
  );
}
