import { CheckCheck, MessageCircle, StickyNote, UserRound } from 'lucide-react';

import { Sparkle, Squiggle } from './decor';
import {
  FeatureGrid,
  FeatureHero,
  FeatureScreen,
  FeatureSplit,
  FeatureTrio,
} from './feature-page';

// ============================================================
// /features/shared-inbox
//
// The argument: a WhatsApp number that a whole team can answer without
// sharing a phone. Everything on the page serves that — assignment,
// private notes, and history that belongs to the customer rather than
// to whoever happened to reply.
// ============================================================

const HUE = 'mint' as const;

export function InboxHero() {
  return (
    <FeatureHero
      eyebrow="Shared team inbox"
      title="One number. Your whole team."
      highlight="whole team"
      hue={HUE}
      body="WhatsApp, Instagram and Messenger land in one thread list. Assign an owner, leave notes the customer never sees, and stop passing a phone around the office."
      visual={<InboxScreen />}
    />
  );
}

function InboxScreen() {
  return (
    <FeatureScreen className="mx-auto max-w-3xl text-left">
      <div className="flex items-center gap-3 border-b-2 border-(--lp2-ink) bg-(--lp2-mint) px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-full border-2 border-(--lp2-ink) bg-white text-xs font-extrabold">
          PR
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">Priya Raman</p>
          <p className="text-xs font-semibold text-(--lp2-ink-soft)">
            +91 98765 43210 · WhatsApp
          </p>
        </div>
        <span className="hidden rounded-full border-2 border-(--lp2-ink) bg-white px-2.5 py-1 text-[10px] font-extrabold sm:inline">
          Assigned to Arjun
        </span>
      </div>

      <div className="space-y-2.5 bg-(--lp2-cream) px-4 py-4">
        <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md border-2 border-(--lp2-ink) bg-white px-3.5 py-2.5 text-[13px] font-medium">
          Hi — is the linen shirt back in medium?
        </div>

        {/* The private note is the point of the screen: a second
            conversation running alongside the first, invisible to the
            customer. Dashed and off-palette so it never reads as a
            message that went out. */}
        <div className="ml-auto w-fit max-w-[90%] rounded-xl border-2 border-dashed border-(--lp2-ink)/40 bg-(--lp2-lemon-soft) px-3.5 py-2 text-[12px] font-medium">
          <span className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold tracking-wide uppercase">
            <StickyNote className="size-3" strokeWidth={3} />
            Internal note · not sent
          </span>
          Restock lands Thursday — she ordered twice last month, worth a
          heads-up.
        </div>

        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md border-2 border-(--lp2-ink) bg-(--lp2-mint) px-3.5 py-2.5 text-[13px] font-medium shadow-[2px_2px_0_var(--lp2-ink)]">
          Yes — medium is back in stock Thursday. Want me to hold one?
          <span className="mt-1 flex items-center justify-end gap-1 text-[10px] font-bold text-(--lp2-ink-soft)">
            Arjun · read
            <CheckCheck className="size-3" strokeWidth={3} />
          </span>
        </div>
      </div>
    </FeatureScreen>
  );
}

export function InboxTrio() {
  return (
    <FeatureTrio
      hue={HUE}
      points={[
        {
          icon: UserRound,
          title: 'Assign an owner',
          body: 'Every conversation has one name against it, so two people never answer the same customer and nobody assumes someone else did.',
        },
        {
          icon: StickyNote,
          title: 'Notes stay internal',
          body: 'Context for the next agent — a preference, a complaint, a promise made — attached to the thread and never delivered.',
        },
        {
          icon: MessageCircle,
          title: 'Three channels, one list',
          body: 'WhatsApp, Instagram and Messenger in the same queue. The customer picks the app; your team learns one screen.',
        },
      ]}
    />
  );
}

export function InboxHistory() {
  return (
    <FeatureSplit
      hue={HUE}
      tint
      title="The history belongs to the customer, not the agent."
      highlight="the customer"
      body="Every message, note, call and deal sits on the contact record. When someone leaves, or is on holiday, or just picks up a thread three months later, the whole story is already there."
      points={[
        'Full thread history from the first message, across all three channels',
        'Tags, custom fields and pipeline stage on the same record',
        'Calls and campaign sends logged beside the chat, not in another tool',
        'Search across every conversation your account has ever had',
      ]}
      visual={<ContactCard />}
    />
  );
}

function ContactCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <FeatureScreen className="p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-mint) text-sm font-extrabold">
            PR
          </span>
          <div className="min-w-0">
            <p className="lp2-display text-base font-extrabold">Priya Raman</p>
            <p className="text-sm font-bold text-(--lp2-ink-soft)">
              Customer since March
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {['Repeat buyer', 'Kochi', 'Newsletter', 'VIP'].map((t) => (
            <span
              key={t}
              className="rounded-full border border-(--lp2-ink)/15 bg-(--lp2-cream) px-2.5 py-1 text-[11px] font-bold"
            >
              {t}
            </span>
          ))}
        </div>

        <dl className="mt-4 space-y-2 border-t-2 border-(--lp2-ink)/10 pt-4 text-sm">
          {[
            ['Conversations', '14 across 3 channels'],
            ['Last order', '#1042 · ₹2,499'],
            ['Pipeline stage', 'Repeat customer'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <dt className="text-(--lp2-ink-soft)">{k}</dt>
              <dd className="font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </FeatureScreen>
      <Sparkle color="lemon" className="absolute -top-5 -right-4 size-7" />
      <Squiggle
        color="sky"
        className="absolute -bottom-4 -left-6 hidden w-14 rotate-12 lg:block"
      />
    </div>
  );
}

export function InboxGrid() {
  return (
    <FeatureGrid
      hue={HUE}
      title="The rest of what a shared inbox needs."
      highlight="a shared inbox"
      subtitle="The parts nobody puts on a landing page, and everybody misses on day two."
      items={[
        {
          title: 'Quick replies',
          body: 'Saved answers for the questions that fill an inbox — pricing, hours, returns — pasted in a keystroke rather than retyped.',
        },
        {
          title: 'Unread that means something',
          body: 'A count per conversation, not a badge on the whole app. What is waiting on you is visible without opening anything.',
        },
        {
          title: 'The 24-hour window, shown',
          body: 'WhatsApp only lets you reply freely for 24 hours after the last customer message. The inbox shows the clock rather than failing the send.',
        },
        {
          title: 'Media, files and voice notes',
          body: 'Send and receive what your customers actually send — photos of a product, a PDF invoice, a voice note when typing is slower.',
        },
      ]}
    />
  );
}
