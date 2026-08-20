import Link from 'next/link';
import type { Metadata } from 'next';

import { DELETION_WINDOW_DAYS } from '@/lib/account/deletion-window';

export const metadata: Metadata = {
  title: 'Account scheduled for deletion',
  robots: { index: false, follow: false },
};

/**
 * Where the middleware sends anyone whose account is inside its
 * deletion window.
 *
 * Deliberately a plain server component with no session read: the
 * visitor here is signed in but locked out, and the page has to render
 * the same whether their token is fresh, stale, or about to be thrown
 * away. It states the deadline and the one way back, and nothing else.
 */
export default function AccountDeletedPage() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          This account is scheduled for deletion
        </h1>

        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Nobody can sign in to it while the deletion is pending. Its data is
          kept for {DELETION_WINDOW_DAYS} days from the day it was requested,
          and is then permanently removed.
        </p>

        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          If this was a mistake, the account owner can restore it before that
          deadline. We will email a confirmation link to the owner&apos;s
          address — restoring it brings back every conversation, contact and
          campaign exactly as they were.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/account-recovery"
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-colors"
          >
            Restore this account
          </Link>
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground flex h-11 items-center justify-center text-sm font-medium transition-colors"
          >
            Back to the homepage
          </Link>
        </div>

        <p className="text-muted-foreground/80 mt-8 text-xs leading-relaxed">
          Once the deadline passes the data cannot be recovered, by you or by
          us. If you need help before then, contact{' '}
          <Link href="/contact-us" className="underline underline-offset-4">
            support
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
