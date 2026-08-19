'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search,
  Loader2,
  Mail,
  Phone,
  User,
  Building2,
  MessageSquareText,
  CircleDot,
  Clock,
  Trash2,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { EnquiryStatusBadge, type EnquiryStatus } from './badges';
import { ExportCsvButton } from './export-csv';
import { fmtDateTime } from '../_lib/format';

export interface ContactRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  status: EnquiryStatus;
  source_path: string | null;
  created_at: string;
}

const STATUS_OPTIONS: { value: EnquiryStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'replied', label: 'Replied' },
  { value: 'spam', label: 'Spam' },
];

type Filter = 'all' | EnquiryStatus;

// The filter is the same four statuses plus an "everything" lead, so it
// derives rather than restating them — one place to add a status.
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All enquiries' },
  ...STATUS_OPTIONS,
];

const CSV_COLUMNS = [
  { header: 'Name', value: (r: ContactRow) => r.name },
  { header: 'Email', value: (r: ContactRow) => r.email },
  { header: 'Phone', value: (r: ContactRow) => r.phone },
  { header: 'Company', value: (r: ContactRow) => r.company },
  { header: 'Status', value: (r: ContactRow) => r.status },
  { header: 'Message', value: (r: ContactRow) => r.message },
  { header: 'Source', value: (r: ContactRow) => r.source_path },
  { header: 'Received', value: (r: ContactRow) => r.created_at },
];

/**
 * The enquiry list, laid out like the tickets table beside it.
 *
 * Clicking a row opens the full enquiry in a modal rather than
 * expanding it in place — reading one no longer shoves every row below
 * it down the page, and there is no /admin/contact/[id] route to send
 * anyone to instead.
 *
 * The open row is tracked by id, not by value, so the modal re-reads
 * from `rows` on every render: marking an enquiry replied refreshes
 * the server data and the badge updates underneath the open dialog.
 */
export function ContactSubmissionsTable({ rows }: { rows: ContactRow[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const openRow = openId ? (rows.find((r) => r.id === openId) ?? null) : null;

  // Always paired: an armed "really delete?" must never survive the
  // dialog closing or a different enquiry opening, or the next row you
  // open is one click from being destroyed.
  function openEnquiry(id: string | null) {
    setOpenId(id);
    setConfirmingDelete(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.company ?? '').toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  async function setStatus(id: string, status: EnquiryStatus) {
    setBusyId(id);
    try {
      const res = await fetch(`/admin/api/contact/${id}`, {
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

  async function remove(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/admin/api/contact/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Could not delete');
        return;
      }
      toast.success('Enquiry deleted');
      // Close first — the row is about to vanish from `rows`, and the
      // dialog reads its content from there.
      openEnquiry(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (!rows.length) {
    return (
      <div className="bg-card rounded-sm border border-(--admin-line) p-10 text-center">
        <p className="text-muted-foreground text-sm">
          No enquiries yet. Submissions from the /contact form land here.
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, company, or message"
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
        {/* Exports the full set, not the filtered view — the button is a
            "give me the data" escape hatch, and silently shipping a
            subset of what the page holds is the wrong surprise. */}
        <ExportCsvButton
          rows={rows}
          filename="enquiries"
          className="h-11 rounded-lg px-3.5"
          columns={CSV_COLUMNS}
        />
      </div>

      <div className="border-border bg-card overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted hover:bg-muted">
              <TableHead icon={User} className="text-muted-foreground">
                From
              </TableHead>
              <TableHead
                icon={Building2}
                className="text-muted-foreground hidden md:table-cell"
              >
                Company
              </TableHead>
              <TableHead
                icon={MessageSquareText}
                className="text-muted-foreground hidden lg:table-cell"
              >
                Message
              </TableHead>
              <TableHead
                icon={CircleDot}
                className="text-muted-foreground w-28"
              >
                Status
              </TableHead>
              <TableHead
                icon={Clock}
                className="text-muted-foreground hidden sm:table-cell"
              >
                Received
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center text-sm"
                >
                  No enquiries match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                // A <tr> is not focusable and takes no keypresses on its
                // own, so opening the modal from the keyboard has to be
                // wired by hand — otherwise the list is mouse-only.
                // Space gets its page-scroll default suppressed.
                <TableRow
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEnquiry(r.id)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    openEnquiry(r.id);
                  }}
                  className="border-border hover:bg-muted/50 cursor-pointer"
                >
                  <TableCell className="text-foreground max-w-xs font-medium">
                    <span className="truncate">{r.name}</span>
                    <span className="text-muted-foreground mt-0.5 block truncate text-xs font-normal">
                      {r.email}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {r.company || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-xs lg:table-cell">
                    <span className="block truncate">{r.message}</span>
                  </TableCell>
                  <TableCell>
                    <EnquiryStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {fmtDateTime(r.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={openRow !== null}
        onOpenChange={(next) => {
          if (!next) openEnquiry(null);
        }}
      >
        <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-lg">
          {openRow && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {openRow.name}
                  <EnquiryStatusBadge status={openRow.status} />
                </DialogTitle>
                <DialogDescription>
                  {openRow.company
                    ? `${openRow.company} · ${fmtDateTime(openRow.created_at)}`
                    : fmtDateTime(openRow.created_at)}
                </DialogDescription>
              </DialogHeader>

              {/* The message can run long — cap it and scroll rather
                  than letting the dialog grow past the viewport. */}
              <p className="text-foreground max-h-64 overflow-y-auto text-sm whitespace-pre-wrap">
                {openRow.message}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <a
                  href={`mailto:${openRow.email}`}
                  className="text-primary inline-flex items-center gap-1.5 font-medium hover:underline"
                >
                  <Mail className="size-3.5" />
                  {openRow.email}
                </a>
                {openRow.phone && (
                  <a
                    href={`tel:${openRow.phone}`}
                    className="text-primary inline-flex items-center gap-1.5 font-medium hover:underline"
                  >
                    <Phone className="size-3.5" />
                    {openRow.phone}
                  </a>
                )}
                {openRow.source_path && (
                  <span className="text-muted-foreground">
                    from {openRow.source_path}
                  </span>
                )}
              </div>

              <div className="border-border flex flex-wrap items-center gap-2 border-t pt-4">
                <span className="text-muted-foreground text-xs">Mark as</span>
                {/* The select shows the CURRENT status, so it doubles as
                    the read-out — no separate "currently: read" line
                    needed. onValueChange only fires on an actual
                    change, so re-picking the same value costs no
                    request. */}
                <Select
                  value={openRow.status}
                  disabled={busyId === openRow.id}
                  onValueChange={(v) =>
                    v && setStatus(openRow.id, v as EnquiryStatus)
                  }
                >
                  <SelectTrigger className="border-border w-40 data-[size=default]:h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {busyId === openRow.id && (
                  <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
                )}

                {/* Confirmation is a second click on the same spot
                    rather than a nested dialog or a native confirm() —
                    stacking a modal on a modal fights the focus trap,
                    and the arming state reads clearly enough inline.
                    It resets whenever the dialog closes or another
                    enquiry opens (see openEnquiry). */}
                <div className="ml-auto flex items-center gap-2">
                  {confirmingDelete ? (
                    <>
                      <span className="text-muted-foreground text-xs">
                        Delete permanently?
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(false)}
                        className="text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busyId === openRow.id}
                        onClick={() => remove(openRow.id)}
                        className="bg-destructive inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === openRow.id}
                      onClick={() => setConfirmingDelete(true)}
                      className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
