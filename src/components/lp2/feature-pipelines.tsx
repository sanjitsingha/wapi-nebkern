import { GitBranch, MessageCircle, Target } from 'lucide-react';

import { Sparkle } from './decor';
import {
  FeatureGrid,
  FeatureHero,
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

const STAGES = [
  { name: 'New enquiry', count: 12, hue: 'sky' },
  { name: 'Qualified', count: 7, hue: 'grape' },
  { name: 'Quoted', count: 4, hue: 'lemon' },
  { name: 'Won', count: 9, hue: 'grass' },
] as const;

export function PipelinesHero() {
  return (
    <FeatureHero
      eyebrow="Sales pipelines"
      title="The chat is the deal."
      highlight="is the deal"
      hue={HUE}
      body="Drag a conversation through your stages and it stays a conversation — same thread, same history, same person. Nobody retypes a WhatsApp chat into a CRM at the end of the day."
      visual={<PipelineBoard />}
    />
  );
}

function PipelineBoard() {
  return (
    <div className="mx-auto max-w-4xl overflow-x-auto">
      <div className="flex min-w-[680px] gap-3 text-left">
        {STAGES.map((s) => (
          <div key={s.name} className="flex-1">
            <div className="flex items-center justify-between rounded-t-xl border-2 border-(--lp2-ink) px-3 py-2"
              style={{ backgroundColor: `var(--lp2-${s.hue}-soft)` }}
            >
              <span className="text-xs font-extrabold">{s.name}</span>
              <span className="rounded-full border-2 border-(--lp2-ink) bg-white px-1.5 text-[10px] font-extrabold">
                {s.count}
              </span>
            </div>
            <div className="space-y-2 rounded-b-xl border-2 border-t-0 border-(--lp2-ink) bg-white p-2">
              {/* Two cards per column is enough to read as a board;
                  more would just be noise at this size. */}
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="rounded-lg border-2 border-(--lp2-ink)/15 bg-(--lp2-cream) p-2"
                >
                  <div className="h-1.5 w-2/3 rounded-full bg-(--lp2-ink)/25" />
                  <div className="mt-1.5 h-1.5 w-1/2 rounded-full bg-(--lp2-ink)/12" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
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
