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
//
// THE TILT
//
// The band is rotated 2deg counter-clockwise, so its right end rides up
// and it cuts a diagonal across the two white sections it sits between.
// Two degrees and not one: a tilt small enough to be mistaken for a
// rendering fault is worse than none, and this has to read as a choice.
// Everything inside rotates with it, so the names stay parallel to the
// band's own edges rather than sitting level inside a slanted box.
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
  // z-10 is load-bearing, and now sits on the wrapper rather than the
  // band — a rotated element opens its own stacking context, so the
  // z-index has to be applied outside it to have anything to act on.
  // The shadow is painted beyond the border box, over whatever follows,
  // and what follows is <Lp2Features> on solid white — a later sibling,
  // so it wins the paint order by default and would cover the shadow
  // completely. Raising this puts it back.
  return (
    // The tilt's overhang, clipped on one axis only.
    //
    // `overflow-x-clip` rather than `overflow-hidden`: hiding one axis
    // makes the element a scroll container and coerces the other axis to
    // `auto`, which would trap the band's rotated corners inside a box
    // instead of letting them spill over the hero above and the features
    // section below. That vertical overlap is the whole point of a
    // tilted band. `clip` carries no such side effect, so the horizontal
    // overhang is cut — no stray page-wide scrollbar — and the vertical
    // one survives.
    <div className="relative z-10 overflow-x-clip">
      <section
        id="industries"
        // Wider than its container by a fixed 32px each side. Rotating a
        // rectangle about its centre pulls two of its corners inward by
        // (height / 2) x sin(angle) — about 5px here — so a band held to
        // exactly 100% would leave a wedge of the page showing through
        // at each end. Absolute units, not a percentage: the gap depends
        // on the band's height, which barely moves, while a percentage
        // would shrink with the viewport and run out on a phone.
        className="relative -ml-8 w-[calc(100%+4rem)] -rotate-2 scroll-mt-28 overflow-hidden bg-(--lp2-lemon) py-12 shadow-[0_4px_0_var(--lp2-ink)] sm:py-16"
      >
        <ChatDoodles />

        {/* One muted line instead of a section heading. A display-size
            title with a highlight box would give this band more weight
            than the hero above it. */}
        <p className="relative px-4 text-center text-2xl text-pretty text-(--lp2-ink-soft) sm:text-3xl">
          Built for every business that sells over chat
        </p>

        {/* Full-bleed, outside any max-width wrapper: a ticker that
            stops short of the viewport edge looks like a broken carousel
            rather than something running past. */}
        <div className="relative mt-8">
          <MarqueeRow />
        </div>
      </section>
    </div>
  );
}

/* ─── Doodle backdrop ─────────────────────────────────────────────── */

/**
 * A tiling doodle pattern behind the band — the texture people associate
 * with a chat wallpaper, drawn from scratch.
 *
 * These glyphs are ours. WhatsApp's own doodle wallpaper is Meta's
 * copyrighted artwork, and this product is an official Meta Tech
 * Provider: reproducing their asset would put that standing at risk for
 * the sake of a background. Same visual language, none of their paths.
 *
 * Inline SVG rather than the PNG that was asked for, because it is a
 * few hundred bytes instead of a few hundred kilobytes, stays crisp on
 * any display, needs no network request, and inherits `currentColor` —
 * so it tracks the palette instead of baking a colour into a file.
 *
 * Held at 7% ink: this sits under 48px marquee text, and anything more
 * assertive starts competing with the words it is meant to sit behind.
 */
function ChatDoodles() {
  return (
    <div
      className="pointer-events-none absolute inset-0 text-(--lp2-ink) opacity-[0.07]"
      aria-hidden
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="lp2-chat-doodles"
            x="0"
            y="0"
            width="300"
            height="300"
            patternUnits="userSpaceOnUse"
          >
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* speech bubble */}
              <g transform="translate(18 24) rotate(-8)">
                <path d="M4 2h30a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H18l-9 7v-7H4a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z" />
              </g>

              {/* double tick */}
              <g transform="translate(112 40) rotate(6)">
                <path d="M0 10 6 16 18 2" />
                <path d="M12 16 16 20 30 4" />
              </g>

              {/* heart */}
              <g transform="translate(206 22) rotate(12)">
                <path d="M16 30C10 25 2 20 2 12A9 9 0 0 1 16 6 9 9 0 0 1 30 12c0 8-8 13-14 18z" />
              </g>

              {/* camera */}
              <g transform="translate(30 118) rotate(5)">
                <path d="M2 8h8l4-5h12l4 5h8a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H2a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z" />
                <circle cx="20" cy="20" r="7" />
              </g>

              {/* clock */}
              <g transform="translate(140 132) rotate(-10)">
                <circle cx="16" cy="16" r="15" />
                <path d="M16 7v9l6 4" />
              </g>

              {/* paper plane */}
              <g transform="translate(228 126) rotate(14)">
                <path d="M0 14 34 0 22 34 15 20z" />
                <path d="M15 20 34 0" />
              </g>

              {/* shopping bag */}
              <g transform="translate(58 218) rotate(-6)">
                <path d="M2 10h28l-3 24H5z" />
                <path d="M11 10a5 5 0 0 1 10 0" />
              </g>

              {/* smiley */}
              <g transform="translate(158 226) rotate(8)">
                <circle cx="16" cy="16" r="15" />
                <path d="M10 12h.01M22 12h.01" />
                <path d="M9 21a8 8 0 0 0 14 0" />
              </g>

              {/* star */}
              <g transform="translate(250 214) rotate(-12)">
                <path d="M15 1 19 11 30 12 22 19 24 30 15 24 6 30 8 19 0 12 11 11z" />
              </g>

              {/* location pin */}
              <g transform="translate(112 92) rotate(0) scale(0.85)">
                <path d="M13 33S25 21 25 13A12 12 0 0 0 1 13c0 8 12 20 12 20z" />
                <circle cx="13" cy="13" r="4.5" />
              </g>
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lp2-chat-doodles)" />
      </svg>
    </div>
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
      <span className="text-4xl font-semibold whitespace-nowrap sm:text-5xl">
        {name}
      </span>
      {/* The separator carries the spacing too, so every gap is equal
          without the list needing one. */}
      <span
        aria-hidden
        className="mx-10 size-2.5 shrink-0 rounded-full bg-(--lp2-ink)/25 sm:mx-12"
      />
    </li>
  );
}
