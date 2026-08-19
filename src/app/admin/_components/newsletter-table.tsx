'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Copy,
  Loader2,
  Search,
  Mail,
  User,
  CircleDot,
  Calendar,
  History,
} from 'lucide-react';

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
import { SubscriberStatusBadge, type SubscriberStatus } from './badges';
import { ExportCsvButton } from './export-csv';
import { fmtDate, fmtDateTime } from '../_lib/format';

export interface SubscriberRow {
  id: string;
  email: string;
  name: string | null;
  status: SubscriberStatus;
  source_path: string | null;
  created_at: string;
  /** Stamped by a trigger on every UPDATE (migration 085). Not the
   *  same as `unsubscribed_at`, which resubscribing clears. */
  updated_at: string;
  /** Signed on the server — the page passes it down rather than the
   *  browser building it, because signing needs the secret. */
  unsubscribe_url: string | null;
}

type Filter = 'all' | SubscriberStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All subscribers' },
  { value: 'subscribed', label: 'Subscribed' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
];

/**
 * The subscriber list, with search and a CSV export.
 *
 * Export exists because this list's whole purpose is to be pasted into
 * whatever actually sends the email — there is no sending built in
 * here, and an address list you cannot get out of the admin panel is
 * an address list nobody can use.
 */
export function NewsletterTable({ rows }: { rows: SubscriberRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: SubscriberStatus) {
    setBusyId(id);
    try {
      const res = await fetch(`/admin/api/newsletter/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Could not update');
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Unsubscribe link copied');
    } catch {
      toast.error('Could not copy — check clipboard permissions');
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (!needle) return true;
      return (
        r.email.toLowerCase().includes(needle) ||
        (r.name ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q, filter]);

  // Only active subscribers: exporting unsubscribes into a sending
  // tool is how people get emailed after asking not to be. The
  // serialising itself moved to the shared button, which quotes
  // properly and writes a BOM so Excel reads the file as UTF-8.
  const active = useMemo(
    () => rows.filter((r) => r.status === 'subscribed'),
    [rows]
  );

  // Nothing at all is a different state from "your search matched
  // nothing", and only this one justifies replacing the table: there
  // are no columns worth showing yet. A no-match goes in the body (see
  // below) so the header and the controls stay put.
  if (!rows.length) {
    return (
      <div className="border-border bg-card rounded-xl border p-10 text-center">
        <p className="text-muted-foreground text-sm">
          No subscribers yet. Signups from /newsletter land here.
        </p>
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
            placeholder="Search email or name"
            className="h-11 pl-9"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
        >
          {/* `data-[size=default]:h-11`, not a plain `h-11`. SelectTrigger
              sets its own height as `data-[size=default]:h-8`, and an
              attribute selector outranks a bare class — so a plain
              `h-11` here is silently ignored and the control renders
              32px next to a 44px input. Matching the variant lets
              tailwind-merge replace it instead of losing to it. */}
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
        {/* The button's own defaults (h-8, rounded-sm) suit a toolbar
            sitting alone. Beside a search field and a select it has to
            borrow their height and radius instead, or it reads as a
            different kind of control. */}
        <ExportCsvButton
          rows={active}
          filename="newsletter"
          label="Export active"
          className="h-11 rounded-lg px-3.5"
          columns={[
            { header: 'email', value: (r) => r.email },
            { header: 'name', value: (r) => r.name },
            { header: 'signed_up', value: (r) => r.created_at },
            { header: 'last_modified', value: (r) => r.updated_at },
            { header: 'source', value: (r) => r.source_path },
          ]}
        />
      </div>

      <div className="border-border bg-card overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted hover:bg-muted">
              <TableHead icon={Mail} className="text-muted-foreground">
                Email
              </TableHead>
              <TableHead
                icon={User}
                className="text-muted-foreground hidden sm:table-cell"
              >
                Name
              </TableHead>
              <TableHead
                icon={CircleDot}
                className="text-muted-foreground w-32"
              >
                Status
              </TableHead>
              <TableHead
                icon={Calendar}
                className="text-muted-foreground hidden md:table-cell"
              >
                Signed up
              </TableHead>
              <TableHead
                icon={History}
                className="text-muted-foreground hidden lg:table-cell"
              >
                Last modified
              </TableHead>
              <TableHead className="text-muted-foreground text-right">
                Actions
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
                  No subscribers match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                // No row click and no modal here: everything a
                // subscriber record holds is already on the row, and
                // the two actions are the point of the page.
                <TableRow key={r.id} className="border-border">
                  <TableCell>
                    <a
                      href={`mailto:${r.email}`}
                      className="text-foreground hover:text-primary font-medium"
                    >
                      {r.email}
                    </a>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {r.name ?? '—'}
                  </TableCell>
                  <TableCell>
                    <SubscriberStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {fmtDate(r.created_at)}
                  </TableCell>
                  {/* Date+time, unlike "Signed up" — this one exists to
                      answer "did that unsubscribe just go through?",
                      where the day alone is no use. */}
                  <TableCell className="text-muted-foreground hidden lg:table-cell">
                    {fmtDateTime(r.updated_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {busyId === r.id && (
                        <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
                      )}
                      {r.unsubscribe_url && (
                        <button
                          type="button"
                          title="Copy this subscriber's unsubscribe link"
                          onClick={() => copyLink(r.unsubscribe_url!)}
                          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                        >
                          <Copy className="size-3.5" />
                          Link
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() =>
                          setStatus(
                            r.id,
                            r.status === 'subscribed'
                              ? 'unsubscribed'
                              : 'subscribed'
                          )
                        }
                        className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-40"
                      >
                        {r.status === 'subscribed'
                          ? 'Unsubscribe'
                          : 'Resubscribe'}
                      </button>
                    </div>
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
