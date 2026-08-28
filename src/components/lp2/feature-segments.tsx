import { Filter, RefreshCw, Users } from 'lucide-react';

import { Sparkle } from './decor';
import {
  FeatureGrid,
  FeatureHero,
  FeatureScreen,
  FeatureSplit,
  FeatureTrio,
} from './feature-page';

// ============================================================
// /features/segments
//
// The argument: sending to everyone is how a WhatsApp number gets
// blocked. A segment is the difference between a campaign and spam,
// and the page has to make the live-vs-static distinction land — it is
// the thing people get wrong.
// ============================================================

const HUE = 'sky' as const;

export function SegmentsHero() {
  return (
    <FeatureHero
      eyebrow="Segments & lists"
      title="Send to the right few hundred."
      highlight="right few hundred"
      hue={HUE}
      body="Filter by tag, pipeline stage, order history or last activity. A segment keeps itself up to date, so the audience is correct the moment you press send — not the moment you built it."
      visual={<SegmentBuilder />}
    />
  );
}

function SegmentBuilder() {
  return (
    <FeatureScreen className="mx-auto max-w-2xl p-5 text-left">
      <p className="lp2-display text-base font-extrabold">
        Segment · Lapsed Kochi buyers
      </p>

      <div className="mt-4 space-y-2">
        {[
          ['Tag', 'is', 'Repeat buyer'],
          ['City', 'is', 'Kochi'],
          ['Last order', 'more than', '60 days ago'],
        ].map(([field, op, value], i) => (
          <div key={field} className="flex flex-wrap items-center gap-2">
            <span className="w-10 shrink-0 text-[10px] font-extrabold tracking-wide text-(--lp2-ink-soft) uppercase">
              {i === 0 ? 'Where' : 'And'}
            </span>
            <span className="rounded-lg border-2 border-(--lp2-ink) bg-white px-2.5 py-1 text-xs font-bold">
              {field}
            </span>
            <span className="text-xs font-medium text-(--lp2-ink-soft)">
              {op}
            </span>
            <span className="rounded-lg border-2 border-(--lp2-ink) bg-(--lp2-sky-soft) px-2.5 py-1 text-xs font-bold">
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t-2 border-(--lp2-ink)/10 pt-4">
        <span className="flex items-center gap-1.5 text-sm font-bold text-(--lp2-ink-soft)">
          <RefreshCw className="size-3.5" strokeWidth={3} />
          Updates itself
        </span>
        <span className="lp2-display text-2xl font-extrabold">
          412 <span className="text-sm font-bold text-(--lp2-ink-soft)">contacts</span>
        </span>
      </div>
    </FeatureScreen>
  );
}

export function SegmentsTrio() {
  return (
    <FeatureTrio
      hue={HUE}
      points={[
        {
          icon: Filter,
          title: 'Build it with filters',
          body: 'Tags, custom fields, pipeline stage, order value, last message, when they joined — stacked into one rule, no query language.',
        },
        {
          icon: RefreshCw,
          title: 'It keeps itself current',
          body: 'A segment is a question, not a snapshot. Anyone who starts matching is in; anyone who stops is out, without you rebuilding it.',
        },
        {
          icon: Users,
          title: 'Lists when you want them frozen',
          body: 'Sometimes you need exactly these people and no others — an event, an import, a one-off. A list holds still on purpose.',
        },
      ]}
    />
  );
}

export function SegmentsLive() {
  return (
    <FeatureSplit
      hue={HUE}
      tint
      flip
      title="A segment answers a question. A list remembers an answer."
      highlight="answers a question"
      body="It is the one distinction worth understanding here, and it decides which one you want. Both send the same way; they differ in what happens the day after you make them."
      points={[
        'Segment: “everyone tagged VIP who hasn’t ordered in 60 days” — membership changes as people do',
        'List: “these 340 people who came to the Kochi popup” — fixed until you edit it',
        'Either can be the audience for a campaign, an automation, or an export',
        'Both show a live count before you send, so nobody guesses at the size',
      ]}
      visual={<CompareCards />}
    />
  );
}

function CompareCards() {
  return (
    <div className="relative mx-auto grid w-full max-w-md gap-4">
      <FeatureScreen className="p-5">
        <p className="flex items-center gap-2 text-sm font-extrabold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-(--lp2-sky-soft)">
            <RefreshCw className="size-3.5 text-(--lp2-sky)" strokeWidth={3} />
          </span>
          Segment
        </p>
        <p className="mt-2 text-sm leading-relaxed text-(--lp2-ink-soft)">
          Re-runs every time. Yesterday 388, today 412 — because 24 more
          people crossed 60 days without ordering.
        </p>
      </FeatureScreen>

      <FeatureScreen className="p-5">
        <p className="flex items-center gap-2 text-sm font-extrabold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-(--lp2-lemon-soft)">
            <Users className="size-3.5 text-(--lp2-tangerine)" strokeWidth={3} />
          </span>
          List
        </p>
        <p className="mt-2 text-sm leading-relaxed text-(--lp2-ink-soft)">
          Holds still. 340 people who scanned the QR at the popup, and the
          same 340 next month.
        </p>
      </FeatureScreen>

      <Sparkle color="lemon" className="absolute -top-4 -right-3 size-6" />
    </div>
  );
}

export function SegmentsGrid() {
  return (
    <FeatureGrid
      hue={HUE}
      title="Built for sending, not just for looking at."
      highlight="for sending"
      subtitle="A segment that can’t be used is a report. These plug straight into the things that reach people."
      items={[
        {
          title: 'Straight into a campaign',
          body: 'Pick a segment as the audience for a broadcast. The count you saw is the count that gets the message.',
        },
        {
          title: 'Opted-out contacts excluded',
          body: 'Anyone who has opted out is dropped from every audience automatically — the one filter you should never have to remember.',
        },
        {
          title: 'Automations can act on membership',
          body: 'Joining a segment is a thing that happens, and a thing an automation can respond to with a message or a tag.',
        },
        {
          title: 'Import and export',
          body: 'Bring a list in from a CSV, or take one out. Your contact data stays yours and stays portable.',
        },
      ]}
    />
  );
}
