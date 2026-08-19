'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Hash,
  MessageSquareText,
  Building2,
  Flag,
  CircleDot,
  Clock,
} from 'lucide-react';

import type { SupportTicketStatus, SupportTicketPriority } from '@/types';
import { formatTicketRef } from '@/lib/support/ticket-ref';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TicketStatusBadge, PriorityBadge } from './badges';
import { fmtDateTime } from '../_lib/format';

export interface TicketView {
  id: string;
  subject: string;
  accountName: string;
  creatorEmail: string | null;
  category: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  updatedAt: string;
  needsReply: boolean;
}

type Filter = 'all' | 'needs_reply' | SupportTicketStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All tickets' },
  { value: 'needs_reply', label: 'Awaiting reply' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function TicketsTable({
  rows,
  initialFilter = 'all',
}: {
  rows: TicketView[];
  initialFilter?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(
    (FILTERS.some((f) => f.value === initialFilter)
      ? initialFilter
      : 'all') as Filter
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'needs_reply') {
        if (!r.needsReply) return false;
      } else if (filter !== 'all' && r.status !== filter) {
        return false;
      }
      if (!q) return true;
      // Ticket ref is searchable with or without the leading '#', so
      // pasting a code straight out of a customer's message works.
      const ref = formatTicketRef(r.id).toLowerCase();
      return (
        ref.includes(q) ||
        ref.slice(1).startsWith(q.replace(/^#/, '')) ||
        r.subject.toLowerCase().includes(q) ||
        r.accountName.toLowerCase().includes(q) ||
        (r.creatorEmail ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subject, account, or email"
            className="h-11 pl-9"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
        >
          {/* Height goes through the `data-[size=default]` variant
              because SelectTrigger's own `data-[size=default]:h-8`
              outranks a plain `h-11` — see newsletter-table.tsx. */}
          <SelectTrigger className="border-border w-full data-[size=default]:h-11 sm:w-52">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-border bg-card overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            {/* Full `bg-muted` rather than /50 so the header reads as a
                distinct band above the rows. The hover has to match it
                — a header inheriting the rows' `hover:bg-muted/50`
                would LIGHTEN on hover, which looks like a mis-click. */}
            <TableRow className="border-border bg-muted hover:bg-muted">
              <TableHead icon={Hash} className="text-muted-foreground w-28">
                Ticket
              </TableHead>
              <TableHead
                icon={MessageSquareText}
                className="text-muted-foreground"
              >
                Subject
              </TableHead>
              <TableHead
                icon={Building2}
                className="text-muted-foreground hidden md:table-cell"
              >
                Account
              </TableHead>
              <TableHead
                icon={Flag}
                className="text-muted-foreground hidden lg:table-cell"
              >
                Priority
              </TableHead>
              <TableHead icon={CircleDot} className="text-muted-foreground">
                Status
              </TableHead>
              <TableHead
                icon={Clock}
                className="text-muted-foreground hidden sm:table-cell"
              >
                Updated
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground h-24 text-center text-sm"
                >
                  No tickets match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.id}
                  onClick={() => router.push(`/admin/tickets/${r.id}`)}
                  className="border-border hover:bg-muted/50 cursor-pointer"
                >
                  {/* Same short code the tenant app shows, so a user
                      quoting "#3F9A2C71" can be matched by eye. */}
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {formatTicketRef(r.id)}
                  </TableCell>
                  <TableCell className="text-foreground max-w-xs font-medium">
                    <div className="flex items-center gap-2">
                      {r.needsReply && (
                        <span
                          aria-label="Awaiting reply"
                          className="size-2 shrink-0 rounded-full bg-amber-500"
                        />
                      )}
                      <span className="truncate">{r.subject}</span>
                    </div>
                    {r.creatorEmail && (
                      <span className="text-muted-foreground mt-0.5 block truncate text-xs font-normal">
                        {r.creatorEmail}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {r.accountName}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <PriorityBadge priority={r.priority} />
                  </TableCell>
                  <TableCell>
                    <TicketStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {fmtDateTime(r.updatedAt)}
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
