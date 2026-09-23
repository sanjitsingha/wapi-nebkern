import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// ============================================================
// "Keep reading" — a row of in-body links near the end of a page.
//
// The nav and footer already link every marketing page from every
// other, but those are boilerplate links Google discounts. A link in
// the body with a descriptive anchor ("How WhatsApp message pricing
// works in India", not "Blog") is the one that passes relevance, and
// it is how the deeper pages — blog posts, individual docs guides —
// get reached from pages that are already indexed.
//
// Server-rendered plain <a> tags, so the links are in the first HTML
// the crawler downloads.
// ============================================================

export type KeepReadingLink = {
  href: string;
  /** Descriptive anchor text — this is what Google reads the link as. */
  title: string;
  blurb: string;
};

export function KeepReading({
  heading = 'Keep reading',
  links,
  padBottom = false,
}: {
  heading?: string;
  links: KeepReadingLink[];
  /** Off above `Lp2Cta`, whose white section already supplies the gap. */
  padBottom?: boolean;
}) {
  return (
    <section
      className={
        padBottom ? 'bg-white py-20 sm:py-28' : 'bg-white pt-20 sm:pt-28'
      }
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h2 className="lp2-display text-2xl font-extrabold text-balance sm:text-3xl">
          {heading}
        </h2>
        <ul
          className={
            links.length === 4
              ? 'mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
              : 'mt-6 grid gap-4 sm:grid-cols-3'
          }
        >
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="group flex h-full flex-col rounded-2xl border-2 border-(--lp2-ink) bg-white p-5 shadow-(--lp2-shadow-sm) transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp2-ink)"
              >
                <span className="text-base font-extrabold text-pretty">
                  {l.title}
                </span>
                <span className="mt-2 flex-1 text-sm leading-relaxed font-medium text-(--lp2-ink-soft)">
                  {l.blurb}
                </span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold">
                  Read
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2.75}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
