// ============================================================
// Industries — the moving ticker.
//
// Sits directly under the hero, doing the job a logo cloud usually
// does: "is this for a business like mine?" answered before anyone has
// to read a feature.
//
// DELIBERATELY THE QUIETEST SECTION ON THE PAGE
//
// The first version gave every industry a coloured icon chip, a 2px
// ink outline and a hard offset shadow — the page's full handwriting,
// applied sixteen times and then set in motion. It read as a toy. This
// band is a supporting fact, not a feature: the hero is directly above
// it and the bento is directly below, and both of those are supposed
// to win. So this is names, a hairline rule top and bottom, and
// nothing else — no chips, no borders, no shadows, no colour.
//
// One row rather than two, for the same reason.
//
// HOW THE LOOP WORKS
//
// The row renders its list twice and the track animates from -50% to 0
// (see `lp2-marquee` in lp2.css). At -50% the viewport shows copy two;
// at 0 it shows copy one — the same pixels — so the restart is
// invisible. Anything that changes the number of copies here has to
// change the keyframe percentage with it.
//
// The second copy is `aria-hidden`, and the strip is a real <ul>, so a
// screen reader hears sixteen industries once rather than thirty-two.
// ============================================================

const INDUSTRIES = [
  'D2C & eCommerce',
  'Clinics & Healthcare',
  'Coaching & EdTech',
  'Real Estate',
  'Travel & Tourism',
  'Salons & Spas',
  'Gyms & Fitness',
  'Automobile',
  'Fashion & Apparel',
  'Restaurants & Cafés',
  'Jewellery',
  'Pharmacy',
  'Logistics & Delivery',
  'Interiors & Furniture',
  'Finance & Insurance',
  'Events & Photography',
];

export function Lp2Industries() {
  return (
    <section
      id="industries"
      className="scroll-mt-28 border-y border-(--lp2-ink)/10 bg-white py-12 sm:py-16"
    >
      {/* One muted line instead of a section heading. A display-size
          title with a highlight box would give this band more weight
          than the hero above it. */}
      <p className="px-4 text-center text-sm text-pretty text-(--lp2-ink-soft) sm:text-base">
        Built for every business that sells over chat
      </p>

      {/* Full-bleed, outside any max-width wrapper: a ticker that stops
          short of the viewport edge looks like a broken carousel rather
          than something running past. */}
      <div className="mt-8">
        <MarqueeRow />
      </div>
    </section>
  );
}

function MarqueeRow() {
  return (
    <div
      className="lp2-marquee relative overflow-hidden"
      style={{
        // Fades both ends into the white section instead of letting
        // names get guillotined at the viewport edge.
        maskImage:
          'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
      }}
    >
      <ul
        className="lp2-marquee-track flex w-max items-center"
        style={{ ['--lp2-marquee-duration' as string]: '70s' }}
      >
        {INDUSTRIES.map((name) => (
          <Item key={name} name={name} />
        ))}
        {/* Copy two. Hidden from assistive tech — it exists only so the
            loop has somewhere seamless to restart from. */}
        {INDUSTRIES.map((name) => (
          <Item key={`dup-${name}`} name={name} duplicate />
        ))}
      </ul>
    </div>
  );
}

function Item({ name, duplicate = false }: { name: string; duplicate?: boolean }) {
  return (
    <li
      aria-hidden={duplicate || undefined}
      className="flex shrink-0 items-center"
    >
      <span className="text-lg font-semibold whitespace-nowrap sm:text-xl">
        {name}
      </span>
      {/* The separator carries the spacing too, so every gap is equal
          without the list needing one. */}
      <span
        aria-hidden
        className="mx-7 size-1.5 shrink-0 rounded-full bg-(--lp2-ink)/25 sm:mx-9"
      />
    </li>
  );
}
