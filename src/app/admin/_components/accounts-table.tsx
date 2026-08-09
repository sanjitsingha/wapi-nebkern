'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

import type { AccountView } from '../_lib/admin-data';
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
import { SubscriptionBadge } from './badges';
import { ExportCsvButton } from './export-csv';
import { fmtDate } from '../_lib/format';

// Shape lives with the loader that builds it. A second copy here was a
// standing invitation for the two to drift; the import is a type-only
// one, erased at compile time, so no server code follows it into the
// bundle. Re-exported because pages already import it from here.
export type { AccountView };

type Filter =
  | 'all'
  | 'trialing'
  | 'active'
  | 'expired'
  | 'past_due'
  | 'canceled'
  | 'trial_ending';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'past_due', label: 'Past due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'trial_ending', label: 'Trial ending ≤ 3d' },
];

export function AccountsTable({
  rows,
  initialFilter = 'all',
}: {
  rows: AccountView[];
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
      if (filter === 'trial_ending') {
        if (!r.isTrial || r.trialDaysLeft > 3) return false;
      } else if (filter !== 'all' && r.status !== filter) {
        return false;
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.ownerEmail ?? '').toLowerCase().includes(q)
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
            placeholder="Search by account name or owner email"
            className="h-9 pl-9"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
        >
          <SelectTrigger className="h-9 w-full border-(--admin-line) sm:w-56">
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
        <ExportCsvButton
          rows={filtered}
          filename="accounts"
          columns={[
            { header: 'Account', value: (r) => r.name },
            { header: 'Owner email', value: (r) => r.ownerEmail },
            { header: 'Plan', value: (r) => r.plan },
            { header: 'Status', value: (r) => r.status },
            { header: 'Members', value: (r) => r.memberCount },
            { header: 'Trial ends', value: (r) => r.trialEndsAt },
            { header: 'Created', value: (r) => r.createdAt },
            { header: 'Account id', value: (r) => r.id },
          ]}
        />
      </div>

      <div className="bg-card overflow-x-auto rounded-sm border border-(--admin-line)">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-muted-foreground">Account</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">
                Owner
              </TableHead>
              <TableHead className="text-muted-foreground">Plan</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground hidden text-right sm:table-cell">
                Members
              </TableHead>
              <TableHead className="text-muted-foreground hidden lg:table-cell">
                Created
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
                  No accounts match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.id}
                  onClick={() => router.push(`/admin/accounts/${r.id}`)}
                  className="border-border hover:bg-muted/50 cursor-pointer"
                >
                  <TableCell className="text-foreground font-medium">
                    {r.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {r.ownerEmail ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize">
                    {r.plan}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <SubscriptionBadge status={r.status} />
                      {r.isTrial && (
                        <span className="text-muted-foreground text-[11px]">
                          {r.trialDaysLeft}d left
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-right tabular-nums sm:table-cell">
                    {r.memberCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden lg:table-cell">
                    {fmtDate(r.createdAt)}
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
