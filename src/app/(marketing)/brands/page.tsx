import type { Metadata } from 'next';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { WaClosingCta } from '@/components/wa/closing-cta';

// ============================================================
// /brands — the logo wall.
//
// ── Why this is noindex, and must stay that way until it is real ──
//
// Every tile below is a placeholder. A page that says "these brands
// run on Instant" is social proof, and social proof invented is a
// false claim about companies that have not agreed to appear — which
// is worse than having no page at all, and is the kind of thing a
// named company can object to.
//
// So the placeholders are deliberately *not* plausible company names.
// They are numbered tiles that could not be mistaken for a real brand
// by a visitor, a journalist or a crawler. Swap each one for a real
// logo you have written permission to display, then delete the
// `robots` block and add the route to sitemap.ts.
// ============================================================

const DESCRIPTION =
  'The businesses running their customer conversations on Instant for WhatsApp Business.';

export const metadata: Metadata = {
  title: { absolute: 'Brands — Instant for WhatsApp Business' },
  description: DESCRIPTION,
  alternates: { canonical: '/brands' },
  // Not indexable while the wall is placeholders. Thin pages of
  // invented proof are exactly what "Crawled — currently not indexed"
  // is for, and this one would deserve it.
  robots: { index: false, follow: true },
};

/** Placeholder tiles. Count, not names — see the note at the top. */
const SLOTS = Array.from({ length: 18 }, (_, i) => i + 1);

export default function BrandsPage() {
  return (
    <>
      <Lp2Nav />
      <main>
        <section className="relative -mt-19 bg-(--lp2-sky-soft) pt-19 sm:-mt-20 sm:pt-20">
          <div className="mx-auto max-w-3xl px-4 pt-16 pb-16 text-center sm:px-6 sm:pt-20 sm:pb-20">
            <h1 className="lp2-display mx-auto max-w-2xl text-3xl leading-[1.12] font-extrabold text-balance sm:text-[2.6rem]">
              The businesses answering on Instant
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-pretty text-(--lp2-ink-soft)">
              D2C brands, clinics, coaching centres and showrooms — running
              enquiries, orders and follow-ups through one WhatsApp number.
            </p>
          </div>
        </section>

        {/* `bg-[var(--wa-white,#fff)]`, not `bg-white`: whatsapp.css
            repaints `section.bg-white` to the cream canvas, so the plain
            utility renders cream and looks like it is doing nothing. */}
        <section className="bg-[var(--wa-white,#ffffff)] px-4 py-16 sm:px-6 sm:py-24">
          <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {SLOTS.map((n) => (
              <li
                key={n}
                className="flex aspect-[3/2] items-center justify-center rounded-2xl border-2 border-dashed border-(--lp2-ink)/15 bg-(--lp2-cream)"
              >
                {/* Dashed and unmistakably empty. A filled grey block
                    reads as a logo that failed to load; a dashed box
                    reads as a slot waiting for one. */}
                <span className="text-xs font-bold tracking-wide text-(--lp2-ink-soft) uppercase">
                  Logo {n}
                </span>
              </li>
            ))}
          </ul>

          <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-(--lp2-ink-soft)">
            Placeholder slots. Customer logos go here once each brand has
            agreed to appear.
          </p>
        </section>
      </main>
      <WaClosingCta />
      <Lp2Footer />
    </>
  );
}
