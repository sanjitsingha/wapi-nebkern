'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { TocItem } from '@/lib/lp2-blog-toc';
import { press } from './ui';

// ============================================================
// Sidebar for /lp-2 article pages: a scroll-spying table of contents
// and, beneath it, a compact promo banner. Client-only because the ToC
// tracks the reader's position with an IntersectionObserver.
// ============================================================

export function BlogToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    if (items.length === 0) return;

    // The rootMargin pulls the "trigger line" down to ~30% from the top
    // so a heading counts as active once it's comfortably on screen,
    // not the instant its top edge clears the sticky nav.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-128px 0px -70% 0px', threshold: 0 },
    );

    const els = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el !== null);
    els.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="On this page">
      <p className="text-xs font-extrabold tracking-wide uppercase text-(--lp2-ink-soft)">
        On this page
      </p>
      <ul className="mt-3 space-y-0.5">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              onClick={() => setActive(it.id)}
              className={cn(
                'block border-l-2 py-1.5 text-sm leading-snug transition-colors',
                // Deeper headings step further in.
                it.level === 2 ? 'pl-3' : it.level === 3 ? 'pl-6' : 'pl-9',
                active === it.id
                  ? 'border-(--lp2-grass) font-bold text-(--lp2-ink)'
                  : 'border-(--lp2-ink)/10 font-semibold text-(--lp2-ink-soft) hover:border-(--lp2-ink)/30 hover:text-(--lp2-ink)',
              )}
            >
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ─── Promo banner ────────────────────────────────────────────────── */

export function PromoBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-mint) p-5 shadow-(--lp2-shadow-sm)',
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-grass)">
        <Sparkles className="size-5 text-white" strokeWidth={2.75} />
      </span>
      <p className="lp2-display mt-3 text-lg font-extrabold">Try wacrm free</p>
      <p className="mt-1.5 text-sm leading-relaxed text-(--lp2-ink-soft)">
        One shared inbox and AI agents on your own WhatsApp number. 14 days,
        no card.
      </p>
      <Link
        href="/signup"
        className={cn(
          'mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-grass) text-sm font-bold text-white shadow-(--lp2-shadow-sm)',
          press,
        )}
      >
        Start free
        <ArrowRight className="size-4" strokeWidth={2.75} />
      </Link>
    </div>
  );
}
