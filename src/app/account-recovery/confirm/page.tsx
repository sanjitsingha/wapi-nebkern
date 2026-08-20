'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';

/**
 * Spends the emailed recovery token.
 *
 * The restore is behind a button rather than fired on page load, and
 * that is deliberate: mail clients and security scanners routinely
 * fetch every link in a message, and a GET that restored the account
 * would let a scanner spend the one-shot token before the owner ever
 * saw the email.
 */
function ConfirmInner() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>(
    'idle'
  );
  const [message, setMessage] = useState<string | null>(null);

  async function restore() {
    setState('working');
    try {
      const res = await fetch('/api/account/recovery/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error ?? 'That link could not be used.');
        setState('failed');
        return;
      }
      setMessage(
        data?.accountName
          ? `${data.accountName} has been restored.`
          : 'The account has been restored.'
      );
      setState('done');
    } catch {
      setMessage('Something went wrong. Please try the link again.');
      setState('failed');
    }
  }

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {state === 'done' ? 'Account restored' : 'Restore this account'}
        </h1>

        {!token && (
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            This link is missing its token. Request a new one from the{' '}
            <Link
              href="/account-recovery"
              className="underline underline-offset-4"
            >
              recovery page
            </Link>
            .
          </p>
        )}

        {token && state !== 'done' && (
          <>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Confirming will cancel the scheduled deletion and bring the
              account back with all of its data. Everyone who had access will be
              able to sign in again straight away.
            </p>
            {message && state === 'failed' && (
              <p className="text-destructive mt-4 text-sm">{message}</p>
            )}
            <Button
              onClick={restore}
              disabled={state === 'working'}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-8 h-11 w-full rounded-xl text-sm font-semibold"
            >
              {state === 'working' ? 'Restoring…' : 'Restore the account'}
            </Button>
          </>
        )}

        {state === 'done' && (
          <>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              {message}
            </p>
            <Link
              href="/login"
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-8 flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-colors"
            >
              Sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function AccountRecoveryConfirmPage() {
  // useSearchParams needs a Suspense boundary to keep the route from
  // opting the whole page into client-side rendering at build time.
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  );
}
