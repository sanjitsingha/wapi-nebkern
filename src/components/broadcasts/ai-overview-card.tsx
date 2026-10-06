'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CampaignAiOverview, CampaignOverviewBasis } from '@/types';

// ============================================================
// The AI overview card on /campaigns/[id].
//
// Generated only when someone asks — each one spends the account's own
// AI tokens — and saved on the campaign, so it is here on the next visit.
// The saved copy remembers the numbers it was written from; when the
// campaign has moved on since (replies still arriving), the card says so
// rather than presenting an old read as current.
// ============================================================

interface AiOverviewCardProps {
  broadcastId: string;
  initialOverview: CampaignAiOverview | null;
  initialGeneratedAt: string | null;
  /** The campaign's counters now, to tell whether the saved read is stale. */
  current: CampaignOverviewBasis;
  sending: boolean;
}

interface ErrorState {
  message: string;
  code?: string;
}

function basisChanged(a: CampaignOverviewBasis, b: CampaignOverviewBasis) {
  return (
    a.delivered !== b.delivered ||
    a.read !== b.read ||
    a.replied !== b.replied ||
    a.failed !== b.failed
  );
}

function Section({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  empty: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {icon}
        {title}
      </h3>
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li
              key={i}
              className="text-sm leading-relaxed text-muted-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground/70">{empty}</p>
      )}
    </div>
  );
}

export function AiOverviewCard({
  broadcastId,
  initialOverview,
  initialGeneratedAt,
  current,
  sending,
}: AiOverviewCardProps) {
  const [overview, setOverview] = useState(initialOverview);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [unsaved, setUnsaved] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/broadcasts/${broadcastId}/ai-overview`, {
        method: 'POST',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({
          message: body?.error ?? `Could not write the overview (HTTP ${res.status})`,
          code: body?.code,
        });
        return;
      }
      setOverview(body.overview);
      setGeneratedAt(body.generatedAt);
      setUnsaved(body.saved === false);
    } catch {
      setError({ message: 'Could not reach the server. Check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  }

  const stale = overview ? basisChanged(overview.basis, current) : false;
  // Overviews saved before the paragraph existed carry two lists instead;
  // run them on so they read the same way.
  const summary = overview
    ? overview.summary ||
      [...(overview.wentWell ?? []), ...(overview.wentWrong ?? [])].join(' ')
    : '';

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">AI overview</p>
            {overview && generatedAt && (
              <p className="text-xs text-muted-foreground">
                Written {formatDistanceToNow(new Date(generatedAt), { addSuffix: true })}
                {' · '}from {overview.basis.delivered.toLocaleString()} delivered
                {' of '}
                {overview.basis.total.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          onClick={generate}
          disabled={loading}
          className="h-9 border-border px-3 text-foreground"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : overview ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? 'Reading the results…' : overview ? 'Refresh' : 'Generate overview'}
        </Button>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <span>{error.message}</span>
            {(error.code === 'ai_not_configured' ||
              error.code === 'invalid_key' ||
              error.code === 'output_limit') && (
              <Link
                href="/settings/maya"
                className="font-medium underline underline-offset-2"
              >
                Open Maya settings
              </Link>
            )}
          </div>
        )}

        {!overview && !loading && (
          <p className="text-sm text-muted-foreground">
            Get a plain-language read of this campaign: what worked, what
            didn&rsquo;t, and what to try next time. Uses your account&rsquo;s
            AI provider from Maya settings.
          </p>
        )}

        {!overview && loading && (
          <div className="space-y-2" aria-hidden>
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
          </div>
        )}

        {overview && (
          <>
            {/* Top: the verdict, then how it went in one paragraph. */}
            <div className="space-y-2">
              <p className="text-base font-medium leading-relaxed text-foreground">
                {overview.headline}
              </p>
              {summary && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {summary}
                </p>
              )}
            </div>

            {/* Bottom: what to do about it. */}
            <div className="border-t border-border pt-4">
              <Section
                title="Suggestions"
                icon={<Lightbulb className="h-4 w-4 text-primary" />}
                items={overview.suggestions}
                empty="No suggestions this time."
              />
            </div>

            {(stale || sending || unsaved) && (
              <p className="text-xs text-muted-foreground">
                {unsaved
                  ? 'This overview could not be saved, so it will be gone when you leave the page.'
                  : sending
                    ? 'The campaign is still sending. Refresh once it finishes for a fuller read.'
                    : 'The numbers have moved since this was written. Refresh for an up-to-date read.'}
              </p>
            )}

            <p className="text-xs text-muted-foreground/70">
              Written by AI from this campaign&rsquo;s numbers. Check it before
              acting on it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
