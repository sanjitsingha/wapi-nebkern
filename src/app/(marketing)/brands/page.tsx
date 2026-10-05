import type { Metadata } from 'next';
import Image from 'next/image';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { WaClosingCta } from '@/components/wa/closing-cta';

// ============================================================
// /brands — where the product is listed.
//
// ── This page is NOT a customer wall ──
//
// It was built as one, then the first logo supplied was Crunchbase —
// a company-data directory, not a business that answers customers on
// WhatsApp. Putting that mark under "these brands run on Instant"
// would be a false claim about a real, named company.
//
// So the page says what is actually true and checkable: these are the
// places Instant has a profile. Every logo added here must be a
// platform we are genuinely listed on; a customer logo belongs on a
// different page, and only with that customer's written permission.
//
// Still noindex: one real logo and a row of empty slots is a thin
// page, and thin pages are what "Crawled — currently not indexed" is
// for. Delete the `robots` block and add the route to sitemap.ts once
// the row is filled.
// ============================================================

const DESCRIPTION =
  'Where to find Instant for WhatsApp Business — our profiles across the platforms that list software.';

export const metadata: Metadata = {
  title: { absolute: 'Brands — Instant for WhatsApp Business' },
  description: DESCRIPTION,
  alternates: { canonical: '/brands' },
  // Not indexable while most of the row is empty — see the note at
  // the top of the file.
  robots: { index: false, follow: true },
};

/** The real listings, each linking to the profile it stands for. */
const LISTINGS = [
  {
    name: 'Crunchbase',
    // The company profile, not a product one — Crunchbase lists
    // Nebkern Technology, which is who builds Instant.
    href: 'https://www.crunchbase.com/organization/nebkern-technology',
    src: '/images/brands/crunchbase.png',
    width: 2326,
    height: 359,
  },
];

/** Slots still to fill. Count, not invented names. */
const SLOTS = Array.from({ length: 11 }, (_, i) => i + 1);

export default function BrandsPage() {
  return (
    <>
      <Lp2Nav />
      <main>
        <section className="relative -mt-19 bg-(--lp2-sky-soft) pt-19 sm:-mt-20 sm:pt-20">
          <div className="mx-auto max-w-3xl px-4 pt-16 pb-16 text-center sm:px-6 sm:pt-20 sm:pb-20">
            <h1 className="lp2-display mx-auto max-w-2xl text-3xl leading-[1.12] font-extrabold text-balance sm:text-[2.6rem]">
              Where you&rsquo;ll find us
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-pretty text-(--lp2-ink-soft)">
              The platforms that list Instant, review it, or carry our profile.
            </p>
          </div>
        </section>

        {/* `bg-[var(--wa-white,#fff)]`, not `bg-white`: whatsapp.css
            repaints `section.bg-white` to the cream canvas, so the plain
            utility renders cream and looks like it is doing nothing. */}
        <section className="bg-[var(--wa-white,#ffffff)] px-4 py-16 sm:px-6 sm:py-24">
          <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {LISTINGS.map((l) => (
              <li key={l.name}>
                {/* `rel` is ours: `target="_blank"` without `noopener`
                    hands the opened page a handle on this one.

                    Greyscale at rest, colour on hover — a wall of marks
                    in their own brand colours fights itself, and the
                    hover makes the tile feel like the link it is. The
                    filter leaves the file untouched. */}
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex aspect-[3/2] items-center justify-center rounded-2xl border-2 border-(--lp2-ink)/10 bg-(--lp2-cream) p-6 transition-transform duration-200 hover:-translate-y-1"
                >
                  <Image
                    src={l.src}
                    alt={`${l.name} — opens in a new tab`}
                    width={l.width}
                    height={l.height}
                    sizes="(min-width: 1024px) 240px, 40vw"
                    className="h-auto w-full max-w-[160px] grayscale transition-[filter] duration-300 group-hover:grayscale-0 motion-reduce:transition-none"
                  />
                </a>
              </li>
            ))}

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
            More listings to come. Each slot is filled only once we are
            genuinely on that platform.
          </p>
        </section>
      </main>
      <WaClosingCta />
      <Lp2Footer />
    </>
  );
}
