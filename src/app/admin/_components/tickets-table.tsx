'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

import type { SupportTicketStatus, SupportTicketPriority } from '@/types';
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
      : 'all') as Filter,
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
      return (
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
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subject, account, or email"
            className="h-11 pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => v && setFilter(v as Filter)}>
          <SelectTrigger className="h-11 w-full border-border sm:w-52">
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

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-muted-foreground">Subject</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">
                Account
              </TableHead>
              <TableHead className="text-muted-foreground hidden lg:table-cell">
                Priority
              </TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground hidden sm:table-cell">
                Updated
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No tickets match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.id}
                  onClick={() => router.push(`/admin/tickets/${r.id}`)}
                  className="cursor-pointer border-border hover:bg-muted/50"
                >
                  <TableCell className="max-w-xs font-medium text-foreground">
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
                      <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                        {r.creatorEmail}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {r.accountName}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <PriorityBadge priority={r.priority} />
                  </TableCell>
                  <TableCell>
                    <TicketStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
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
