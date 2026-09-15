import Image from 'next/image';

import { cn } from '@/lib/utils';

// ============================================================
// The hero's conversation — the right-hand side of the landing page hero.
//
// Five designed message bubbles (public/images/hero-section/1.png to
// 5.png), in order: a customer asks about an offer, the business answers,
// sends the details as a PDF, and the customer books. Like a real chat,
// the customer's messages (1, 3, 5) sit on the left and the business's
// replies (2, 4) on the right, across the full width of the block. Each
// image already carries its own bubble shape and shadow, so the component
// only has to place them.
//
// SIZING
//
// The PNGs are exported at different pixel sizes. Each is drawn at the
// same scale — its natural width as a share of a 1000px basis — so the
// lettering matches across bubbles and they all shrink together on narrow
// screens. The basis is wider than the widest bubble (2.png, 807px), so
// even that one stops short of the far edge and the left/right split
// still reads. "Yes, please." (3) carries a `scale` of 1.4: at the shared
// scale it read as too small beside the longer bubbles.
//
// ENTRANCE — "push up"
//
// Messages arrive one after another the way they land in a real chat: the
// new one appears at the bottom, fading and rising into place, and pushes
// the ones above it up as it grows. Two layers make that work without the
// page jumping:
//
//  - a ghost copy of the finished conversation, invisible, sits in normal
//    flow and reserves the block's full final height from the start;
//  - the live stack is pinned to the bottom of that space. Each message
//    starts at zero height and grows to its own (grid rows 0fr → 1fr), so
//    while it grows everything above it is pushed upward.
//
// For people who have asked their OS for reduced motion, no animation
// runs and the conversation simply shows, complete.
// ============================================================

type Side = 'customer' | 'business';

interface Message {
  src: string;
  width: number;
  height: number;
  side: Side;
  alt: string;
  /** Extra size on top of the shared scale. */
  scale?: number;
}

const MESSAGES: Message[] = [
  {
    src: '/images/hero-section/1.png',
    width: 576,
    height: 145,
    side: 'customer',
    alt: 'Customer: Hi, I saw your offer for the Premium Package. Is it still available?',
  },
  {
    src: '/images/hero-section/2.png',
    width: 807,
    height: 218,
    side: 'business',
    alt: 'Business: Hi Rahul! Yes, it is. The Premium Package is currently ₹2,999. Would you like me to share the details?',
  },
  {
    src: '/images/hero-section/3.png',
    width: 361,
    height: 87,
    side: 'customer',
    alt: 'Customer: Yes, please.',
    scale: 1.4,
  },
  {
    src: '/images/hero-section/4.png',
    width: 497,
    height: 341,
    side: 'business',
    alt: 'Business: sends a PDF — Absolutely. Here are the details. Would you like to book it for today?',
  },
  {
    src: '/images/hero-section/5.png',
    width: 361,
    height: 87,
    side: 'customer',
    alt: 'Customer: Yes, I’d like to book it.',
  },
];

/** Natural width that maps to 100% of the block. */
const BASIS = 1000;

/** Gap between messages. Lives inside each message (as top padding) rather
 *  than on the list, so a message that has not arrived yet takes up no
 *  space at all — gap included. */
const GAP = 'pt-3';

function Bubble({ m, i, ghost }: { m: Message; i: number; ghost?: boolean }) {
  return (
    <div className={cn('flex', m.side === 'customer' ? 'justify-start' : 'justify-end', i > 0 && GAP)}>
      <Image
        src={m.src}
        alt={ghost ? '' : m.alt}
        width={m.width}
        height={m.height}
        // The top two are in view the moment the page opens.
        priority={!ghost && i < 2}
        sizes="(min-width: 1024px) 460px, 80vw"
        className="h-auto"
        style={{ width: `${((m.width * (m.scale ?? 1)) / BASIS) * 100}%` }}
      />
    </div>
  );
}

export function WaHeroChat() {
  return (
    // Pushed to the right edge of its column on desktop rather than
    // centred in it: the headline sits flush on the left content edge, so
    // a centred block would leave more space on the right than the left.
    <div className="relative mx-auto w-full max-w-[560px] lg:mr-0">
      {/* Ghost: reserves the finished conversation's height. */}
      <div aria-hidden className="invisible">
        {MESSAGES.map((m, i) => (
          <Bubble key={m.src} m={m} i={i} ghost />
        ))}
      </div>

      {/* Live stack, pinned to the bottom of the reserved space. */}
      <ol aria-label="Example WhatsApp conversation" className="absolute inset-x-0 bottom-0 flex flex-col">
        {MESSAGES.map((m, i) => (
          <li
            key={m.src}
            // grid-rows animates 0fr → 1fr (see wa-bubble-push in
            // whatsapp.css); the inner min-h-0 box lets the row collapse
            // to nothing before the message arrives.
            className="grid grid-rows-[1fr] motion-safe:animate-[wa-bubble-push_650ms_cubic-bezier(0.22,1,0.36,1)_both]"
            style={{ animationDelay: `${200 + i * 750}ms` }}
          >
            <div className="min-h-0 overflow-hidden">
              <Bubble m={m} i={i} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
