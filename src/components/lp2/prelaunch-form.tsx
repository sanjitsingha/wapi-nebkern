'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Turnstile, captchaRequired } from './turnstile';
import { press } from './ui';

const field =
  'w-full rounded-xl border-2 border-(--lp2-ink) bg-white px-4 py-3 text-sm font-medium outline-none placeholder:text-(--lp2-ink)/35 focus-visible:border-(--lp2-grass)';

export function PrelaunchForm() {
  const pathname = usePathname();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    setSending(true);
    try {
      const res = await fetch('/api/prelaunch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          organization: form.get('organization'),
          phone: form.get('phone'),
          email: form.get('email'),
          website: form.get('website'), // honeypot
          captchaToken: token,
          sourcePath: pathname,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          data.error ?? 'Could not submit your details. Please try again.'
        );
        return;
      }
      setSent(true);
    } catch {
      toast.error('Could not submit your details. Please try again.');
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
        <p className="lp2-display mt-3 text-2xl font-extrabold">
          You&rsquo;re on the list!
        </p>
        <p className="mt-2 text-lg font-medium text-(--lp2-ink-soft)">
          Thanks for your interest. We&rsquo;ll be in touch soon with more
          details about the early access offer.
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
        <label className="block sm:col-span-2">
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
          <span className="mb-1.5 block text-xs font-extrabold">
            Phone Number *
          </span>
          <input
            name="phone"
            type="tel"
            required
            maxLength={40}
            className={field}
            placeholder="+91 98765 43210"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-extrabold">
            Organization Name{' '}
            <span className="font-medium text-(--lp2-ink-soft)">
              (optional)
            </span>
          </span>
          <input
            name="organization"
            maxLength={160}
            className={field}
            placeholder="Nova Store"
          />
        </label>
      </div>

      {/* Honeypot */}
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
        {sending ? 'Submitting...' : 'Get Early Access'}
      </button>

      <p className="mt-3 text-center text-base font-medium text-(--lp2-ink-soft)">
        We&rsquo;ll only use your details to contact you about this offer. See
        our{' '}
        <a href="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
