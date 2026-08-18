'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Turnstile, captchaRequired } from './turnstile';
import { press } from './ui';

// ============================================================
// The contact form.
//
// Name, email and message are required; phone and company are not —
// every extra required field costs submissions, and neither is needed
// to write a reply.
//
// On success the form is replaced by a confirmation rather than being
// cleared: a cleared form looks identical to one that silently failed,
// and "did that send?" is the whole reason people submit twice.
// ============================================================

const field =
  'w-full rounded-xl border-2 border-(--lp2-ink) bg-white px-4 py-3 text-sm font-medium outline-none placeholder:text-(--lp2-ink)/35 focus-visible:border-(--lp2-grass)';

export function Lp2ContactForm() {
  const pathname = usePathname();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          phone: form.get('phone'),
          company: form.get('company'),
          message: form.get('message'),
          website: form.get('website'),
          captchaToken: token,
          sourcePath: pathname,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Could not send your message');
        return;
      }
      setSent(true);
    } catch {
      toast.error('Could not send your message');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-mint) p-8 text-center shadow-(--lp2-shadow)">
        <CheckCircle2
          className="mx-auto size-10 text-(--lp2-grass)"
          strokeWidth={2.5}
        />
        <p className="lp2-display mt-3 text-2xl font-extrabold">Message sent</p>
        <p className="mt-2 text-lg font-medium text-(--lp2-ink-soft)">
          We reply to everything within one business day — usually sooner.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-cream) p-6 shadow-(--lp2-shadow) sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-extrabold">Name *</span>
          <input
            name="name"
            required
            maxLength={120}
            className={field}
            placeholder="Priya Raman"
          />
        </label>
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
        <label className="block">
          <span className="mb-1.5 block text-xs font-extrabold">Phone</span>
          <input
            name="phone"
            maxLength={40}
            className={field}
            placeholder="+91 98765 43210"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-extrabold">Company</span>
          <input
            name="company"
            maxLength={160}
            className={field}
            placeholder="Nova Store"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-extrabold">
          How can we help? *
        </span>
        <textarea
          name="message"
          required
          rows={5}
          maxLength={4000}
          className={cn(field, 'resize-none')}
          placeholder="Tell us what you're trying to do and we'll point you at the fastest route."
        />
      </label>

      {/* Honeypot. Hidden from people, irresistible to form-filling
          bots; the server treats any value here as spam. Not
          `display:none` — some bots skip those — and aria-hidden +
          tabIndex keep it away from assistive tech and the tab order. */}
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
          'mt-5 inline-flex h-13 items-center justify-center gap-2 rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-grass) px-7 text-base font-bold text-white shadow-(--lp2-shadow) disabled:cursor-not-allowed disabled:opacity-60',
          press
        )}
      >
        {sending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowRight className="size-4" strokeWidth={2.75} />
        )}
        {sending ? 'Sending…' : 'Send message'}
      </button>

      <p className="mt-3 text-base font-medium text-(--lp2-ink-soft)">
        We use what you send here only to reply. See the{' '}
        <a href="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
