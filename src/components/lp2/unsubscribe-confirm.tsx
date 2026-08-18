'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { press } from './ui';

/**
 * The confirm step of the unsubscribe link.
 *
 * A button rather than acting on page load: mail scanners and
 * link-preview bots fetch every URL in an incoming message, so an
 * unsubscribe that fires on GET would quietly remove people who never
 * opened the email. One click is a small price for that not happening.
 */
export function UnsubscribeConfirm({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function unsubscribe() {
    setBusy(true);
    try {
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Could not unsubscribe you');
        return;
      }
      setDone(true);
    } catch {
      toast.error('Could not unsubscribe you');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-mint) p-8 text-center shadow-(--lp2-shadow)">
        <CheckCircle2
          className="mx-auto size-10 text-(--lp2-grass)"
          strokeWidth={2.5}
        />
        <p className="lp2-display mt-3 text-2xl font-extrabold">
          You&rsquo;re unsubscribed
        </p>
        <p className="mt-2 text-lg font-medium text-(--lp2-ink-soft)">
          <span className="font-bold">{email}</span> won&rsquo;t get the
          newsletter again. Nothing else about your account changes.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex text-sm font-bold underline underline-offset-4"
        >
          Back to the site
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-cream) p-8 shadow-(--lp2-shadow)">
      <p className="text-base leading-relaxed font-medium">
        Unsubscribe <span className="font-extrabold">{email}</span> from the
        Instant newsletter?
      </p>
      <p className="mt-2 text-lg leading-relaxed text-(--lp2-ink-soft)">
        This only stops the newsletter. It does not touch your account, your
        workspace, or anything your customers receive.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={unsubscribe}
          disabled={busy}
          className={cn(
            'inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-coral) px-6 text-sm font-bold shadow-(--lp2-shadow) disabled:opacity-60',
            press
          )}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? 'Unsubscribing…' : 'Yes, unsubscribe me'}
        </button>

        <Link
          href="/"
          className={cn(
            'inline-flex h-12 items-center justify-center rounded-xl border-2 border-(--lp2-ink) bg-white px-6 text-sm font-bold shadow-(--lp2-shadow)',
            press
          )}
        >
          Keep me subscribed
        </Link>
      </div>
    </div>
  );
}
