'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { LEGAL_LINKS } from './legal-links';

/**
 * The sidebar on every legal page: the other documents, not the current
 * one's headings.
 *
 * These policies cross-reference each other constantly — the DPA points
 * at the Subprocessor List, the Marketing Policy at Acceptable Use — so
 * the useful thing to put beside a document is the way to the next one.
 *
 * A client component only because it needs `usePathname` to mark the
 * current page; keeping it separate lets the page shell around it stay
 * a server component.
 */
export function LegalNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Legal documents">
      <p className="text-xs font-extrabold tracking-wide uppercase">
        Legal &amp; policies
      </p>
      <ul className="mt-4 space-y-1">
        {LEGAL_LINKS.map((l) => {
          const isCurrent = pathname === l.href;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  'block rounded-xl px-2.5 py-1.5 text-sm font-semibold transition-colors',
                  isCurrent
                    ? 'bg-(--lp2-cream) text-(--lp2-ink)'
                    : 'text-(--lp2-ink-soft) hover:bg-(--lp2-cream) hover:text-(--lp2-ink)',
                )}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
