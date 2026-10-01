import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { hardShadowButton } from '@/components/lp2/ui';
import { Magnetic } from '@/components/ui/magnetic-button';
import { cn } from '@/lib/utils';
import { WaRail } from './rail';
import { waType } from './ui';

// ============================================================
// How each industry actually uses Instant — a card per trade, in the
// same scrolling rail the features use.
//
// The short chip list further up the page names sixteen industries;
// this says something about a handful of them. Kept to a few on
// purpose: a rail of sixteen near-identical cards is a list, not an
// argument.
//
// ── Two placeholders in here ──
//
// The artwork is a tinted block, not a photograph. It is deliberately
// empty rather than a stock image standing in for a real customer.
//
// `href` points at the closest page that exists today. There are no
// /industries/* pages yet, and pointing a "read more" at a 404 is
// worse than pointing it somewhere true but general. When those pages
// land, this is the only place to change.
// ============================================================

interface Industry {
  name: string;
  body: string;
  href: string;
  /**
   * The artwork, once there is one. Optional: an industry without a
   * picture keeps the flat tint, so the rail never waits on assets.
   * `width`/`height` are the file's true pixels.
   */
  image?: { src: string; width: number; height: number };
  /** Tint behind the artwork, from the lp2 hue tokens. */
  hue: string;
}

const INDUSTRIES: Industry[] = [
  {
    name: 'D2C & eCommerce',
    body: 'Recover the carts people abandon, confirm orders in the thread they were bought in, and answer "where is my parcel" before it becomes a support ticket.',
    href: '/industries/d2c-ecommerce',
    image: { src: '/images/industries/d2c-hero.jpg', width: 1600, height: 600 },
    hue: 'var(--lp2-lemon)',
  },
  {
    name: 'Clinics & Healthcare',
    body: 'Appointment reminders that cut no-shows, reports sent to the patient rather than the front desk, and follow-ups that go out without anyone remembering to send them.',
    href: '/features/shared-inbox',
    image: { src: '/images/industries/healthcare.avif', width: 1697, height: 1131 },
    hue: 'var(--lp2-mint)',
  },
  {
    name: 'Coaching & EdTech',
    body: 'Qualify enquiries the moment they arrive, run batch reminders to everyone enrolled, and keep the whole parent conversation on one record.',
    href: '/industries/education',
    image: { src: '/images/industries/coaching.jpg', width: 900, height: 600 },
    hue: 'var(--lp2-sky)',
  },
  {
    name: 'Real Estate',
    body: 'Every site-visit enquiry lands in one inbox, moves through your own stages as it warms, and carries its full chat history into the deal.',
    href: '/features/pipelines',
    image: { src: '/images/industries/real-estate.webp', width: 1201, height: 667 },
    hue: 'var(--lp2-coral)',
  },
  {
    name: 'Restaurants & Cafés',
    body: 'Take table bookings in chat, push the weekend menu to everyone who opted in, and let the AI answer the timings question for the hundredth time.',
    href: '/features/segments',
    image: { src: '/images/industries/restaurants.png', width: 1620, height: 1080 },
    hue: 'var(--lp2-tangerine)',
  },
];

export function WaIndustriesRail() {
  return (
    <WaRail
      id="industries"
      label="Industries"
      title="However you sell, the conversation is the same"
      subtitle="The trade changes. Enquiries arriving faster than anyone can answer them does not. Here is what that looks like in a few of them."
    >
      {INDUSTRIES.map((industry) => (
        <article
          key={industry.name}
          data-card
          className={cn(
            // `lp2-hard-shadow` carries no styling — it is the opt-out
            // from whatsapp.css's blanket `box-shadow: none !important`,
            // without which this shadow is stripped and nothing renders.
            'lp2-hard-shadow group relative flex shrink-0 snap-start overflow-hidden rounded-[25px] bg-white',
            'shadow-[4px_4px_0_2px_rgba(0,0,0,0.05)]',
            // One card at a time. The divisor is 1.08 rather than 1 so
            // the next card shows a sliver at the screen edge — with a
            // card filling the viewport exactly, nothing tells the
            // reader the rail scrolls at all.
            //
            // Below sm the artwork would leave no room for the words,
            // so the split only starts at sm.
            'sm:min-h-[440px]',
            'w-[92%]',
            'sm:w-[calc((100vw-56px)/1.08)]',
            'lg:w-[calc((100vw-72px)/1.08)]',
            'xl:w-[calc(((100vw+1232px)/2-48px)/1.08)]',
          )}
        >
          {/* Pinned to 40%, not `flex-1`. If this flexed, widening the
              artwork on hover would re-wrap the paragraph under the
              pointer — the text would visibly reflow every time someone
              moved over the card. A fixed column cannot. */}
          <div className="flex w-full flex-col p-7 sm:w-[40%] sm:shrink-0 sm:p-8">
            <h3 className="text-[24px] leading-[28px] text-(--wa-ink)">
              {industry.name}
            </h3>
            <p
              className={cn(
                waType.bodyMd,
                'mt-4 flex-1 text-pretty text-(--wa-ink-muted)',
              )}
            >
              {industry.body}
            </p>
            <div className="mt-7">
              <Magnetic>
                <Link href={industry.href} className={hardShadowButton}>
                  Read more
                  <span className="sr-only"> about {industry.name}</span>
                  <ArrowRight className="size-4" strokeWidth={2.5} />
                </Link>
              </Magnetic>
            </div>
          </div>
          {/* Artwork: half the card at rest, widening to 60% while the
              card is hovered. `group` is on the <article>, so the
              whole card is the target rather than the picture — the
              text is the part you read, and reaching the image to
              make it grow would be a strange thing to ask.

              Width is a layout property, so this reflows the text
              column each frame. Fine for one card; if a future rail
              animates several at once, move to a transform.

              `motion-safe:` on the expansion, not the transition:
              anyone who asked for reduced motion keeps a still card at
              50% rather than a faster-growing one.

              The tint shows through for any industry whose picture has
              not landed — a flat colour rather than a stock photo
              standing in for someone's real business. `alt=""`: the
              heading beside it already names the trade. */}
          <div
            className="absolute inset-y-0 right-0 hidden w-[50%] transition-[width] duration-500 ease-out motion-safe:group-hover:w-[60%] sm:block"
            style={{ backgroundColor: industry.hue }}
          >
            {industry.image && (
              <Image
                src={industry.image.src}
                alt=""
                fill
                sizes="(min-width: 1280px) 840px, 60vw"
                // Grey at rest, colour while the card is hovered — the same
                // trigger as the widening, so one gesture does both.
                //
                // `motion-reduce:transition-none` rather than dropping the
                // effect: someone who asked for less motion still gets the
                // colour, it just arrives at once instead of fading in.
                className="object-cover grayscale transition-[filter] duration-500 ease-out group-hover:grayscale-0 motion-reduce:transition-none"
              />
            )}
          </div>
        </article>
      ))}
    </WaRail>
  );
}
