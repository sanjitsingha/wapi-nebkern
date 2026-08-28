import { BarChart3, FileCheck, Send } from 'lucide-react';

import { Sparkle } from './decor';
import {
  FeatureGrid,
  FeatureHero,
  FeatureScreen,
  FeatureSplit,
  FeatureTrio,
} from './feature-page';

// ============================================================
// /features/campaigns
//
// The argument: bulk WhatsApp that arrives, rather than bulk WhatsApp
// that gets a number blocked. Template approval and opt-out handling
// are the unglamorous half and they carry the page — anyone who has
// been rate-limited by Meta knows why.
// ============================================================

const HUE = 'coral' as const;

export function CampaignsHero() {
  return (
    <FeatureHero
      eyebrow="Broadcast campaigns"
      title="Reach thousands. Sound like one person."
      highlight="thousands"
      hue={HUE}
      body="Send an approved template to a segment, with each message carrying that customer's own name, order or booking. Delivery and read rates arrive live, not in a report next week."
      visual={<CampaignStats />}
    />
  );
}

function CampaignStats() {
  return (
    <FeatureScreen className="mx-auto max-w-2xl text-left">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-(--lp2-ink) bg-(--lp2-coral-soft) px-4 py-3">
        <p className="text-sm font-extrabold">Diwali offer · Lapsed buyers</p>
        <span className="rounded-full border-2 border-(--lp2-ink) bg-white px-2.5 py-0.5 text-[10px] font-extrabold">
          Sending
        </span>
      </div>

      <div className="grid grid-cols-2 divide-x-2 divide-y-2 divide-(--lp2-ink)/10 sm:grid-cols-4 sm:divide-y-0">
        {[
          ['Sent', '412'],
          ['Delivered', '406'],
          ['Read', '318'],
          ['Replied', '47'],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-5 text-center">
            <p className="lp2-display text-2xl font-extrabold sm:text-3xl">
              {value}
            </p>
            <p className="mt-0.5 text-[11px] font-bold tracking-wide text-(--lp2-ink-soft) uppercase">
              {label}
            </p>
          </div>
        ))}
      </div>
    </FeatureScreen>
  );
}

export function CampaignsTrio() {
  return (
    <FeatureTrio
      hue={HUE}
      points={[
        {
          icon: FileCheck,
          title: 'Templates, managed here',
          body: 'Write one, submit it to Meta, and watch its status. You find out a template was rejected before a campaign depends on it, not during.',
        },
        {
          icon: Send,
          title: 'Personalised per recipient',
          body: 'Name, order number, appointment time, tracking link — each message filled from that contact’s own record rather than sent generic.',
        },
        {
          icon: BarChart3,
          title: 'Numbers while it runs',
          body: 'Delivered, read and replied update as the send goes out. A campaign that is landing badly can be stopped instead of finished.',
        },
      ]}
    />
  );
}

export function CampaignsCompliance() {
  return (
    <FeatureSplit
      hue={HUE}
      tint
      title="The part that keeps your number alive."
      highlight="keeps your number alive"
      body="WhatsApp is not email. Send the wrong thing to the wrong list often enough and Meta lowers your quality rating, then your limits, then your number stops sending. The unglamorous machinery here exists to prevent exactly that."
      points={[
        'Opted-out contacts are removed from every audience automatically',
        'Every message carries an opt-out route, because one that does not is a complaint',
        'Only APPROVED templates can be selected — a rejected one cannot be sent by mistake',
        'Sends are paced to your number’s tier rather than fired all at once',
      ]}
      visual={<QualityCard />}
    />
  );
}

function QualityCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <FeatureScreen className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="lp2-display text-base font-extrabold">
              Number quality
            </p>
            <p className="text-sm font-bold text-(--lp2-ink-soft)">
              +91 98765 43210
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border-2 border-(--lp2-ink) bg-(--lp2-mint) px-3 py-1 text-xs font-extrabold">
            <span className="size-2 rounded-full bg-(--lp2-grass)" />
            High
          </span>
        </div>

        <dl className="mt-4 space-y-2 border-t-2 border-(--lp2-ink)/10 pt-4 text-sm">
          {[
            ['Messaging tier', '10,000 / 24h'],
            ['Opt-outs this month', '3 of 4,120 sent'],
            ['Templates approved', '18 of 19'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <dt className="text-(--lp2-ink-soft)">{k}</dt>
              <dd className="font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </FeatureScreen>
      <Sparkle color="lemon" className="absolute -top-4 -right-3 size-6" />
    </div>
  );
}

export function CampaignsGrid() {
  return (
    <FeatureGrid
      hue={HUE}
      title="A campaign is the start of a conversation."
      highlight="the start"
      subtitle="Everything sent here lands in an inbox a person can reply to — which is the whole reason to use WhatsApp instead of email."
      items={[
        {
          title: 'Replies come back to the inbox',
          body: 'Someone answering a broadcast opens a normal conversation, assigned and answerable. Not a no-reply address.',
        },
        {
          title: 'Schedule it, or send now',
          body: 'Pick a time that suits the audience rather than the person pressing the button — including a different day entirely.',
        },
        {
          title: 'Test before the whole list',
          body: 'Send to yourself or a small list first. Variables filled with real data, so a broken placeholder shows up before 4,000 people see it.',
        },
        {
          title: 'Every send is logged',
          body: 'Who received what, when, and what happened next — on the contact record, not in a separate reporting tool.',
        },
      ]}
    />
  );
}
