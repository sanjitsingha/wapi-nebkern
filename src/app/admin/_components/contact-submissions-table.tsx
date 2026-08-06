'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, Loader2, Mail, Phone } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface ContactRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  status: 'new' | 'read' | 'replied' | 'spam';
  source_path: string | null;
  created_at: string;
}

const STATUSES: ContactRow['status'][] = ['new', 'read', 'replied', 'spam'];

const STATUS_STYLE: Record<ContactRow['status'], string> = {
  new: 'bg-primary-soft text-primary',
  read: 'bg-muted text-muted-foreground',
  replied: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  spam: 'bg-destructive/10 text-destructive',
};

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * The enquiry list. Rows expand in place rather than opening a detail
 * page: the whole record is five short fields, and the job here is
 * triage — read it, mark it, move on.
 */
export function ContactSubmissionsTable({ rows }: { rows: ContactRow[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: ContactRow['status']) {
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

  if (!rows.length) {
    return (
      <div className="border-border bg-card rounded-xl border p-10 text-center">
        <p className="text-muted-foreground text-sm">
          No enquiries yet. Submissions from the /contact form land here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
      {rows.map((r) => {
        const open = openId === r.id;
        return (
          <div key={r.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : r.id)}
              className="hover:bg-muted/50 flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors"
            >
              <span
                className={cn(
                  'mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize',
                  STATUS_STYLE[r.status]
                )}
              >
                {r.status}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-foreground text-sm font-semibold">
                    {r.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {r.email}
                  </span>
                  {r.company && (
                    <span className="text-muted-foreground text-xs">
                      · {r.company}
                    </span>
                  )}
                </span>
                {/* One line when collapsed — enough to recognise it
                    without opening, never enough to wrap the row. */}
                <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                  {r.message}
                </span>
              </span>

              <span className="text-muted-foreground hidden shrink-0 text-xs sm:block">
                {when(r.created_at)}
              </span>
              <ChevronDown
                className={cn(
                  'text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform',
                  open && 'rotate-180'
                )}
              />
            </button>

            {open && (
              <div className="border-border bg-muted/30 space-y-4 border-t px-4 py-4">
                <p className="text-foreground text-sm whitespace-pre-wrap">
                  {r.message}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <a
                    href={`mailto:${r.email}`}
                    className="text-primary inline-flex items-center gap-1.5 font-medium hover:underline"
                  >
                    <Mail className="size-3.5" />
                    {r.email}
                  </a>
                  {r.phone && (
                    <a
                      href={`tel:${r.phone}`}
                      className="text-primary inline-flex items-center gap-1.5 font-medium hover:underline"
                    >
                      <Phone className="size-3.5" />
                      {r.phone}
                    </a>
                  )}
                  {r.source_path && (
                    <span className="text-muted-foreground">
                      from {r.source_path}
                    </span>
                  )}
                  <span className="text-muted-foreground sm:hidden">
                    {when(r.created_at)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground mr-1 text-xs">
                    Mark as
                  </span>
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busyId === r.id || r.status === s}
                      onClick={() => setStatus(r.id, s)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-40',
                        r.status === s
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                  {busyId === r.id && (
                    <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
