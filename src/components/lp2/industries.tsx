// ============================================================
// Industries — the moving ticker.
//
// Sits directly under the hero, doing the job a logo cloud usually
// does: "is this for a business like mine?" answered before anyone has
// to read a feature.
//
// ONE FLAT COLOUR, AND NOTHING ELSE
//
// The first version gave every industry a coloured icon chip, a 2px
// ink outline and a hard offset shadow — the page's full handwriting,
// applied sixteen times and then set in motion. It read as a toy.
//
// The colour now lives in the band instead of in the items: a flat
// field of lemon carrying the same ink names as before. That buys the
// separation the old hairline rules were for — a yellow stripe between
// the cream hero and the bento needs no border to announce where it
// starts — and it costs nothing per item, so sixteen names in motion
// still read as one object rather than sixteen competing ones. The
// restraint that matters is unchanged: no chips, no outlines, no
// shadows, one row.
//
// --lp2-lemon is the saturated sticker hue, not the --lp2-lemon-soft
// wash the palette normally reserves for surfaces. It is used flat and
// full-bleed here on purpose: this band is one horizontal stripe with
// no cards on it, so the thing the wash exists to protect — ink text
// sitting on a large field of colour — is satisfied by lemon itself at
// ~12.6:1.
//
// The text stays ink for that reason. White on lemon is ~1.4:1, so any
// future move to white names has to take the background to
// --lp2-grass with it; those two travel together or not at all.
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
  // The sticker shadow, adapted for a full-bleed band.
  //
  // --lp2-shadow is `4px 4px 0` and every other caller pairs it with a
  // 2px ink outline on a card. Neither half transfers verbatim here:
  // this section spans the viewport, so its right-hand offset would be
  // painted past the screen edge and never seen, and a box that runs
  // edge to edge has no outline to cast from. What is left is the part
  // that reads — a hard, un-blurred ink edge along the bottom — so that
  // is what this asks for, at the same 4px and the same ink.
  //
  // z-10 is load-bearing. The shadow is painted outside the border box,
  // over whatever follows, and what follows is <Lp2Features> on solid
  // white — a later sibling, so it wins the paint order by default and
  // would cover the shadow completely. Raising this band puts it back.
  return (
    <section
      id="industries"
      className="relative z-10 scroll-mt-28 bg-(--lp2-lemon) py-12 shadow-[0_4px_0_var(--lp2-ink)] sm:py-16"
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
        // Fades both ends into the lemon band instead of letting names
        // get guillotined at the viewport edge. The mask acts on the
        // track, not on a backdrop, so it reveals whatever the section
        // is painted — no need to keep a colour in step here.
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
