'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2, ExternalLink, FileText } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { fmtDateTime } from '../_lib/format';

export interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: 'draft' | 'published';
  tags: string[];
  published_at: string | null;
  updated_at: string;
}

export function BlogPostsTable({ posts }: { posts: BlogPostRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function del(p: BlogPostRow) {
    if (!confirm(`Delete "${p.title}"? This can't be undone.`)) return;
    setBusyId(p.id);
    try {
      const res = await fetch(`/admin/api/blog/${p.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Delete failed');
        return;
      }
      toast.success('Post deleted');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <FileText className="size-5" />
        </span>
        <p className="mt-4 text-sm font-medium text-foreground">No posts yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Click “New post” to write your first article.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((p) => {
        const busy = busyId === p.id;
        return (
          <div
            key={p.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/blog/editor?id=${p.id}`}
                  className="truncate text-sm font-semibold text-foreground hover:text-primary"
                >
                  {p.title}
                </Link>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    p.status === 'published'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {p.status === 'published' ? 'Published' : 'Draft'}
                </span>
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
              {p.excerpt && (
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                  {p.excerpt}
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                /blog/{p.slug}
                {p.published_at
                  ? ` · Published ${fmtDateTime(p.published_at)}`
                  : ''}{' '}
                · Edited {fmtDateTime(p.updated_at)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {p.status === 'published' && (
                <Link
                  href={`/blog/${p.slug}`}
                  target="_blank"
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="View post"
                >
                  <ExternalLink className="size-3.5" />
                </Link>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-border"
                onClick={() => router.push(`/admin/blog/editor?id=${p.id}`)}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={busy}
                onClick={() => del(p)}
                className="size-8 text-destructive hover:bg-destructive/10"
                aria-label="Delete post"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
