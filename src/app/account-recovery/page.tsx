'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DELETION_WINDOW_DAYS } from '@/lib/account/deletion-window';

/**
 * Public request form for an account recovery link.
 *
 * Always renders the same acknowledgement, matching what the API
 * returns — this page is reachable by anyone, and telling a stranger
 * whether an address belongs to a deleting account would be a free
 * lookup service. The honest-looking "check your inbox" is the point,
 * not a shortcut.
 */
export default function AccountRecoveryPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await fetch('/api/account/recovery/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Swallowed on purpose: the acknowledgement below is unconditional
      // anyway, so a network blip should not produce a different screen
      // from a successful send.
    } finally {
      setSending(false);
      setSent(true);
    }
  }

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Restore a deleted account
        </h1>

        {sent ? (
          <>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              If that address belongs to an account that can still be restored,
              a recovery link is on its way. It works once and expires in 24
              hours.
            </p>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Nothing arrived? The link only goes to the address of the account
              <em> owner</em>, and only while the account is inside its{' '}
              {DELETION_WINDOW_DAYS}-day window.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-primary hover:text-primary/80 mt-6 text-sm font-medium"
            >
              Try a different address
            </button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Enter the account owner&apos;s email address. We will send a link
              that restores the account with all of its data, provided it is
              still within {DELETION_WINDOW_DAYS} days of being deleted.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-email">Owner&apos;s email</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>

              <Button
                type="submit"
                disabled={sending || !email.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 w-full rounded-xl text-sm font-semibold"
              >
                {sending ? 'Sending…' : 'Send recovery link'}
              </Button>
            </form>
          </>
        )}

        <p className="text-muted-foreground/80 mt-8 text-xs">
          <Link href="/login" className="underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
