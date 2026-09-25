import Image from 'next/image';

import { Highlight, Sparkle } from './decor';
import {
  FeatureGrid,
  FeatureScreen,
  FeatureSplit,
} from './feature-page';

// ============================================================
// /features/pipelines
//
// The argument: the deal and the conversation are the same thing. Every
// other CRM makes you retype a WhatsApp chat into a deal record; here
// the chat IS the record, and the board is a view of it.
// ============================================================

const HUE = 'grape' as const;

/**
 * Its own hero rather than `FeatureHero`: exactly one screen tall with
 * the navbar included, on white, no chip and no button — the headline
 * and the product carry it. The screenshot runs on past the fold and is
 * cropped by the section's bottom edge, which reads as "there's more
 * board below" rather than as a picture that stops.
 */
export function PipelinesHero() {
  // `bg-[var(--wa-white,#fff)]`, not `bg-white`: whatsapp.css repaints
  // `section.bg-white` to the cream canvas, so the plain utility
  // rendered this hero cream. The fallback keeps it white under the
  // playful design, which never defines --wa-white.
  return (
    <section className="relative -mt-19 flex h-svh min-h-[560px] flex-col overflow-hidden bg-[var(--wa-white,#ffffff)] pt-19 sm:-mt-20 sm:pt-20">
      <div className="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 pt-10 text-center sm:px-6 sm:pt-14">
        <h1 className="lp2-display text-4xl leading-[1.05] font-extrabold text-balance sm:text-6xl lg:text-7xl">
          The chat <Highlight color={HUE}>is the deal</Highlight>.
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
          Drag a conversation through your stages and it stays a
          conversation — same thread, same history, same person. Nobody
          retypes a WhatsApp chat into a CRM at the end of the day.
        </p>

        {/* Takes whatever height is left; the section's overflow-hidden
            crops the bottom of the screenshot at the fold. The image
            carries a transparent margin around its window frame, so it sits
            straight on the hero whatever colour that is.

            From sm the board breaks out of the max-w-5xl text column and
            centres on 86vw instead: `ml-[50%]` with `-translate-x-1/2`
            centres it on the column's midpoint, which is the viewport's,
            whatever the column is doing. 86vw rather than 100vw keeps a
            margin so it reads as a board and not a bleed, and the 1700px
            cap stops it outgrowing its 2152px source on a wide screen.
            
            A wider board is a taller one, so more of its bottom is cropped
            at the fold — the trade this hero already makes. */}
        <div className="mt-8 min-h-0 w-full flex-1 sm:mt-10 sm:ml-[50%] sm:w-[86vw] sm:max-w-[1500px] sm:-translate-x-1/2">
          <Image
            src="/images/features/sales-pipeline.png"
            alt="The Instant sales pipeline board: deals in New Lead, Qualified, Proposal Sent, Negotiation and Won columns, with pipeline value and win totals above"
            width={2152}
            height={1052}
            sizes="(min-width: 640px) 86vw, 100vw"
            preload
            // `drop-shadow`, not `shadow-*`. A box-shadow traces the element
            // box, and 20% of this PNG is fully transparent padding around
            // the board — so the box sits well outside what you can see and
            // the shadow floated off in the margin. A drop-shadow filter
            // follows the alpha channel, so it hugs the board's real edge.
            //
            // No `lp2-hard-shadow` needed: whatsapp.css resets box-shadow,
            // not filters, so this is not stripped. Thrown up and right at a
            // distance: 12px across, -12px up, zero blur. drop-shadow takes no
            // spread, so the 2px the landing-page tiles use is not an option.
            //
            // Lifts 8px on hover. `motion-safe:` so it simply does not move
            // for anyone who asked their OS for reduced motion, rather than
            // moving more gently.
            //
            // It survives whatsapp.css on a technicality worth knowing: that
            // file cancels hover slides with `[class*=" hover:translate"]`,
            // and this class reads `hover:-translate` — the minus keeps it
            // out of the match. Change it to a positive translate and it
            // will silently stop moving.
            className="h-auto w-full drop-shadow-[12px_-12px_0_rgba(0,0,0,0.05)] transition-transform duration-300 ease-out motion-safe:hover:-translate-y-2"
          />
        </div>
      </div>
    </section>
  );
}

export function PipelinesAutomation() {
  return (
    <FeatureSplit
      hue={HUE}
      tint
      flip
      title="A stage change is something you can act on."
      highlight="act on"
      body="Moving a card is not just bookkeeping. It is an event, and an automation can answer it — so the follow-up that everyone means to send actually goes out."
      points={[
        'Moved to Quoted → send the quote template and set a reminder',
        'Sat in one stage too long → nudge the owner, or the customer',
        'Marked Won → tag the contact, add them to the repeat-buyer segment',
        'Every change is logged against the contact, with who moved it',
      ]}
      visual={<StageRule />}
    />
  );
}

function StageRule() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <FeatureScreen className="p-5">
        <span className="text-[10px] font-extrabold tracking-wide text-(--lp2-ink-soft) uppercase">
          When
        </span>
        <p className="mt-1 rounded-lg border-2 border-(--lp2-ink) bg-(--lp2-grape-soft) px-3 py-2 text-sm font-bold">
          A deal moves to “Quoted”
        </p>

        <span className="mt-4 block text-[10px] font-extrabold tracking-wide text-(--lp2-ink-soft) uppercase">
          Then
        </span>
        <div className="mt-1 space-y-2">
          {['Send template · quote_followup', 'Wait 2 days', 'Notify the owner if no reply'].map(
            (a) => (
              <p
                key={a}
                className="rounded-lg border-2 border-(--lp2-ink)/15 bg-(--lp2-cream) px-3 py-2 text-sm font-medium"
              >
                {a}
              </p>
            ),
          )}
        </div>
      </FeatureScreen>
      <Sparkle color="lemon" className="absolute -top-4 -right-3 size-6" />
    </div>
  );
}

export function PipelinesGrid() {
  return (
    <FeatureGrid
      hue={HUE}
      title="Enough CRM to run on, and no more."
      highlight="to run on"
      subtitle="The record under the board — the fields you need, without a six-week implementation."
      items={[
        {
          title: 'Custom fields',
          body: 'Whatever your business needs on a contact: order size, referral source, renewal date. Filterable, and usable in a template.',
        },
        {
          title: 'Tags that mean something',
          body: 'Applied by hand or by an automation, and the same tags your segments filter on. One vocabulary across the product.',
        },
        {
          title: 'Assignment and ownership',
          body: 'A deal has an owner, and so does the conversation behind it. Workload is visible rather than assumed.',
        },
        {
          title: 'Nothing is retyped',
          body: 'A new WhatsApp enquiry can create the contact and the deal on its own. The data enters once, at the point it arrives.',
        },
      ]}
    />
  );
}
