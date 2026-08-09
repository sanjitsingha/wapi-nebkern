'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Turnstile, captchaRequired } from './turnstile';
import { press } from './ui';

// ============================================================
// Newsletter signup: email required, name optional.
//
// The name field is second and explicitly marked optional rather than
// being dropped altogether — it costs nothing to skip, and an address
// with a name attached is worth more to whoever writes the emails.
// ============================================================

const field =
  'w-full rounded-xl border-2 border-(--lp2-ink) bg-white px-4 py-3 text-sm font-medium outline-none placeholder:text-(--lp2-ink)/35 focus-visible:border-(--lp2-grass)';

export function Lp2NewsletterForm() {
  const pathname = usePathname();
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    setSending(true);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          name: form.get('name'),
          website: form.get('website'),
          captchaToken: token,
          sourcePath: pathname,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Could not sign you up');
        return;
      }
      setDone(true);
    } catch {
      toast.error('Could not sign you up');
    } finally {
      setSending(false);
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
          You&rsquo;re in
        </p>
        <p className="mt-2 text-sm font-medium text-(--lp2-ink-soft)">
          One email a month, with a one-click unsubscribe link in every one.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-cream) p-6 shadow-(--lp2-shadow) sm:p-8"
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-extrabold">Email *</span>
        <input
          name="email"
          type="email"
          required
          maxLength={200}
          className={field}
          placeholder="you@company.com"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-extrabold">
          Name{' '}
          <span className="font-medium text-(--lp2-ink-soft)">(optional)</span>
        </span>
        <input
          name="name"
          maxLength={120}
          className={field}
          placeholder="Priya"
        />
      </label>

      {/* Honeypot — see contact-form.tsx for why it is positioned
          off-screen rather than display:none. */}
      <div
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
      >
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="mt-5">
        <Turnstile onToken={setToken} />
      </div>

      <button
        type="submit"
        disabled={sending || (captchaRequired && !token)}
        className={cn(
          'mt-5 inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-grass) px-7 text-base font-bold text-white shadow-(--lp2-shadow) disabled:cursor-not-allowed disabled:opacity-60',
          press
        )}
      >
        {sending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowRight className="size-4" strokeWidth={2.75} />
        )}
        {sending ? 'Signing you up…' : 'Subscribe'}
      </button>

      <p className="mt-3 text-center text-xs font-medium text-(--lp2-ink-soft)">
        No spam, no selling your address. Unsubscribe whenever — see the{' '}
        <a href="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
