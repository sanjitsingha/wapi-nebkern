import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * The legal documents surfaced on the auth pages.
 *
 * The canonical list of every policy lives in `components/lp2/legal-links.ts`
 * — that is what the marketing footer and the legal-page sidebar render, and
 * it stays the source of truth for which documents exist. These pages want a
 * different cut of it: the few a person is actually entering into by signing
 * in or signing up, under short labels that keep the row on one line inside a
 * `max-w-sm` column.
 *
 * Held as its own list rather than filtered out of the canonical one so that a
 * reorder or rename over there can never silently empty this row — the login
 * page losing its policy links is not a failure anyone would notice. The
 * hrefs, however, must keep matching it.
 */
const AUTH_LEGAL: { label: string; href: string }[] = [
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Cookies', href: '/cookies' },
];

/**
 * Every legal link on these pages opens in a new tab.
 *
 * Not decoration: these sit beside half-filled forms. Navigating away from
 * signup in the same tab throws away the name, email and password already
 * typed, and browsers restore none of it reliably on Back. `prefetch={false}`
 * because the policies are static routes, so the default would pull each one
 * down in full the moment the row scrolls into view, for a link almost nobody
 * follows from here.
 */
function LegalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      prefetch={false}
      className={cn(
        'underline-offset-4 transition-colors hover:underline',
        className
      )}
    >
      {children}
    </Link>
  );
}

/**
 * A quiet row of policy links, for the pages where the user is not agreeing
 * to anything new by being there — sign in, and the two password-reset steps.
 */
export function AuthLegalLinks({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Legal"
      className={cn(
        'mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs',
        className
      )}
    >
      {AUTH_LEGAL.map((doc, i) => (
        <Fragment key={doc.href}>
          {i > 0 && (
            <span aria-hidden="true" className="text-muted-foreground/40">
              ·
            </span>
          )}
          <LegalLink
            href={doc.href}
            className="text-muted-foreground hover:text-foreground"
          >
            {doc.label}
          </LegalLink>
        </Fragment>
      ))}
    </nav>
  );
}

/**
 * The consent line for signup.
 *
 * Sits directly under the submit button rather than in a footer, because this
 * is the one place on the site where pressing a button forms an agreement,
 * and the sentence has to be next to the button it describes. Deliberately
 * not a checkbox: agreement is by the act of creating the account, and the
 * wording says so. If a checkbox is ever wanted instead, the consent has to
 * be recorded server-side to be worth anything — the box alone proves
 * nothing.
 */
export function SignupLegalConsent({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'text-muted-foreground mt-4 text-center text-xs leading-relaxed',
        className
      )}
    >
      By creating an account, you agree to our{' '}
      <LegalLink href="/terms" className="text-foreground font-medium">
        Terms of Service
      </LegalLink>{' '}
      and{' '}
      <LegalLink href="/privacy" className="text-foreground font-medium">
        Privacy Policy
      </LegalLink>
      .
    </p>
  );
}
