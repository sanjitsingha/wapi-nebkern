import {
  Camera,
  Car,
  Dumbbell,
  Gem,
  GraduationCap,
  Landmark,
  Pill,
  Plane,
  Shirt,
  ShoppingBag,
  Sofa,
  Sparkles,
  Stethoscope,
  Truck,
  UtensilsCrossed,
  Building2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { SectionHead } from './ui';
import type { Lp2Hue } from './decor';

// ============================================================
// Industries — the moving ticker.
//
// Sits directly under the hero, doing the job a logo cloud usually
// does: "is this for a business like mine?" answered before anyone has
// to read a feature. A ticker rather than a static grid because
// sixteen names in a grid is a wall nobody reads, while sixteen names
// moving past is a glance.
//
// HOW THE LOOP WORKS
//
// Each row renders its list twice and the track animates from -50% to
// 0 (see `lp2-marquee` in lp2.css). At -50% the viewport shows copy
// two; at 0 it shows copy one — the same pixels — so the restart is
// invisible. Anything that changes the number of copies here has to
// change the keyframe percentage with it.
//
// The second copy is `aria-hidden`, and the whole strip is a real
// <ul>, so a screen reader hears sixteen industries once rather than
// thirty-two.
//
// The rows run at different speeds on purpose. Two tracks at one speed
// read as a single block sliding; the offset is what makes it look
// like depth instead of a table on wheels.
// ============================================================

type Industry = { name: string; icon: typeof Camera; hue: Lp2Hue };

/**
 * Hues dark enough to carry a white glyph. The pale ones — lemon at
 * #ffd84d, tangerine at #ff9138 — are nowhere near it, and a white
 * icon on either disappears.
 *
 * Derived from the hue rather than set per item, the way
 * `integrations.tsx` does it with a `white` flag: contrast is a
 * property of the colour, so a new industry on `grass` should not be
 * able to get it wrong.
 */
const DEEP: ReadonlySet<Lp2Hue> = new Set(['grass', 'sky', 'grape', 'coral']);

const ROW_ONE: Industry[] = [
  { name: 'D2C & eCommerce', icon: ShoppingBag, hue: 'grass' },
  { name: 'Clinics & Healthcare', icon: Stethoscope, hue: 'sky' },
  { name: 'Coaching & EdTech', icon: GraduationCap, hue: 'grape' },
  { name: 'Real Estate', icon: Building2, hue: 'tangerine' },
  { name: 'Travel & Tourism', icon: Plane, hue: 'coral' },
  { name: 'Salons & Spas', icon: Sparkles, hue: 'lemon' },
  { name: 'Gyms & Fitness', icon: Dumbbell, hue: 'grass' },
  { name: 'Automobile', icon: Car, hue: 'sky' },
];

const ROW_TWO: Industry[] = [
  { name: 'Fashion & Apparel', icon: Shirt, hue: 'grape' },
  { name: 'Restaurants & Cafés', icon: UtensilsCrossed, hue: 'tangerine' },
  { name: 'Jewellery', icon: Gem, hue: 'coral' },
  { name: 'Pharmacy', icon: Pill, hue: 'grass' },
  { name: 'Logistics & Delivery', icon: Truck, hue: 'sky' },
  { name: 'Interiors & Furniture', icon: Sofa, hue: 'lemon' },
  { name: 'Finance & Insurance', icon: Landmark, hue: 'grape' },
  { name: 'Events & Photography', icon: Camera, hue: 'tangerine' },
];

export function Lp2Industries() {
  return (
    <section id="industries" className="scroll-mt-28 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead
          hue="lemon"
          title="Every business that sells over chat"
          highlight="sells over chat"
          subtitle="If your customers message you before they buy, Instant fits — these are the ones who do it most."
        />
      </div>

      {/* Full-bleed, outside the max-width wrapper: a ticker that stops
          short of the viewport edge looks like a broken carousel
          rather than something running past. */}
      <div className="mt-12 space-y-4">
        <MarqueeRow items={ROW_ONE} seconds={52} />
        <MarqueeRow items={ROW_TWO} seconds={64} />
      </div>
    </section>
  );
}

function MarqueeRow({
  items,
  seconds,
}: {
  items: Industry[];
  seconds: number;
}) {
  return (
    <div
      className="lp2-marquee relative overflow-hidden"
      style={{
        // Fades both ends into the white section instead of letting
        // pills get guillotined at the viewport edge.
        maskImage:
          'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
      }}
    >
      <ul
        className="lp2-marquee-track flex w-max items-center gap-4"
        style={
          { '--lp2-marquee-duration': `${seconds}s` } as React.CSSProperties
        }
      >
        {items.map((it) => (
          <IndustryPill key={it.name} item={it} />
        ))}
        {/* Copy two. Hidden from assistive tech — it exists only so the
            loop has somewhere seamless to restart from. */}
        {items.map((it) => (
          <IndustryPill key={`dup-${it.name}`} item={it} duplicate />
        ))}
      </ul>
    </div>
  );
}

function IndustryPill({
  item,
  duplicate = false,
}: {
  item: Industry;
  duplicate?: boolean;
}) {
  const Icon = item.icon;
  return (
    <li
      aria-hidden={duplicate || undefined}
      className="flex shrink-0 items-center gap-3 rounded-2xl border-2 border-(--lp2-ink) bg-white px-5 py-3 shadow-(--lp2-shadow-sm)"
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `var(--lp2-${item.hue})` }}
      >
        <Icon
          className={cn('size-4', DEEP.has(item.hue) && 'text-white')}
          strokeWidth={2.75}
        />
      </span>
      <span className="text-sm font-bold whitespace-nowrap sm:text-base">
        {item.name}
      </span>
    </li>
  );
}
