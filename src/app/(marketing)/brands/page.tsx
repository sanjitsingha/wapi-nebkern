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

        {/* A black band, and the marks reversed out of it rather than
            each sitting in its own tile. Tiles gave twelve boxes equal
            weight whether or not they held anything; on black the logos
            are the only thing there is.

            `brightness-0 invert` is what makes them white: brightness(0)
            flattens every colour to black, invert(1) flips that to
            white, and the transparent background is untouched — so this
            works for any logo supplied as a PNG with alpha, whatever
            colour it arrives in. */}
        <section className="bg-black px-4 py-20 sm:px-6 sm:py-28">
          <ul className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-16 gap-y-12">
            {LISTINGS.map((l) => (
              <li key={l.name}>
                {/* `rel` is ours: `target="_blank"` without `noopener`
                    hands the opened page a handle on this one. */}
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block opacity-80 transition-opacity duration-200 hover:opacity-100"
                >
                  <Image
                    src={l.src}
                    alt={`${l.name} — opens in a new tab`}
                    width={l.width}
                    height={l.height}
                    sizes="(min-width: 1024px) 200px, 45vw"
                    className="h-auto w-[150px] brightness-0 invert sm:w-[180px]"
                  />
                </a>
              </li>
            ))}
          </ul>

          <p className="mx-auto mt-14 max-w-2xl text-center text-sm leading-relaxed text-white/50">
            More listings as they go live. Each one is added only once we are
            genuinely on that platform.
          </p>
        </section>
      </main>
      <WaClosingCta />
      <Lp2Footer />
    </>
  );
}
