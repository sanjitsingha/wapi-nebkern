'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Download, Loader2, Search } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface SubscriberRow {
  id: string;
  email: string;
  name: string | null;
  status: 'subscribed' | 'unsubscribed';
  source_path: string | null;
  created_at: string;
  /** Signed on the server — the page passes it down rather than the
   *  browser building it, because signing needs the secret. */
  unsubscribe_url: string | null;
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: SubscriberRow['status']) {
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
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(needle) ||
        (r.name ?? '').toLowerCase().includes(needle)
    );
  }, [rows, q]);

  function exportCsv() {
    // Only active subscribers: exporting unsubscribes into a sending
    // tool is how people get emailed after asking not to be.
    const active = rows.filter((r) => r.status === 'subscribed');
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [
      'email,name,signed_up',
      ...active.map((r) =>
        [esc(r.email), esc(r.name ?? ''), esc(r.created_at)].join(',')
      ),
    ].join('\n');

    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email or name"
            className="border-border bg-card text-foreground focus-visible:border-primary h-9 w-full rounded-lg border pr-3 pl-9 text-sm outline-none"
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="border-border text-foreground hover:bg-muted inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors"
        >
          <Download className="size-4" />
          Export active as CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="border-border bg-card rounded-xl border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            {rows.length
              ? 'Nothing matches that search.'
              : 'No subscribers yet. Signups from /newsletter land here.'}
          </p>
        </div>
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-border bg-muted/40 border-b text-left">
              <tr className="text-muted-foreground text-xs font-medium">
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Signed up</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">
                    <a
                      href={`mailto:${r.email}`}
                      className="text-foreground hover:text-primary font-medium"
                    >
                      {r.email}
                    </a>
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5">
                    {r.name ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-medium',
                        r.status === 'subscribed'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5">
                    {when(r.created_at)}
                  </td>
                  <td className="px-4 py-2.5">
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
                        className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40"
                      >
                        {r.status === 'subscribed'
                          ? 'Unsubscribe'
                          : 'Resubscribe'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
