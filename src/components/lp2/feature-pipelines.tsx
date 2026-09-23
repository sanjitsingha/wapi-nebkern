import Image from 'next/image';
import { GitBranch, MessageCircle, Target } from 'lucide-react';

import { Highlight, Sparkle } from './decor';
import {
  FeatureGrid,
  FeatureScreen,
  FeatureSplit,
  FeatureTrio,
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
  return (
    <section className="relative -mt-19 flex h-svh min-h-[560px] flex-col overflow-hidden bg-white pt-19 sm:-mt-20 sm:pt-20">
      <div className="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 pt-10 text-center sm:px-6 sm:pt-14">
        <h1 className="lp2-display text-5xl leading-[1.05] font-extrabold text-balance sm:text-7xl lg:text-8xl">
          The chat <Highlight color={HUE}>is the deal</Highlight>.
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
          Drag a conversation through your stages and it stays a
          conversation — same thread, same history, same person. Nobody
          retypes a WhatsApp chat into a CRM at the end of the day.
        </p>

        {/* Takes whatever height is left; the section's overflow-hidden
            crops the bottom of the screenshot at the fold. The image
            carries its own white margin and window frame, so it sits
            straight on the white hero. */}
        <div className="mt-8 min-h-0 flex-1 sm:mt-10">
          <Image
            src="/images/features/sales-pipeline.png"
            alt="The Instant sales pipeline board: deals in New Lead, Qualified, Proposal Sent, Negotiation and Won columns, with pipeline value and win totals above"
            width={2152}
            height={1052}
            sizes="(min-width: 1024px) 1024px, 100vw"
            preload
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
}

export function PipelinesTrio() {
  return (
    <FeatureTrio
      hue={HUE}
      points={[
        {
          icon: GitBranch,
          title: 'Your stages, your words',
          body: 'Name the columns after how you actually sell. Add one, reorder them, run a different board for a different product line.',
        },
        {
          icon: MessageCircle,
          title: 'Open the deal, read the chat',
          body: 'The whole thread is inside the card. No tab-switching to work out what was promised, or when, or by whom.',
        },
        {
          icon: Target,
          title: 'Value and owner on the card',
          body: 'What it is worth and who is chasing it, visible on the board rather than buried a click deep.',
        },
      ]}
    />
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
