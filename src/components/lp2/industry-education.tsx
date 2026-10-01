import Image from 'next/image';
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  GraduationCap,
  MessageCircle,
} from 'lucide-react';

import { FeatureGrid, FeatureSplit } from './feature-page';
import { WaStatsTabs, type WaStat } from '@/components/wa/stats-tabs';
import { Btn } from './ui';

// ============================================================
// /industries/education — coaching centres, institutes and EdTech.
//
// Organised along the student lifecycle (enquiry → admission →
// onboarding → retention), which is the shape that fits the trade
// rather than the shape of our feature list.
//
// Every claim is one the product already makes elsewhere: shared
// inbox, Maya, campaigns on approved templates, automations, flows,
// pipelines, segments, the Meta Ads connector, REST API and webhooks.
// No outcome figures — "lifts admissions by N%" is a number we have no
// data for, and a page that prints one has to defend it.
//
// Fee *collection* is deliberately absent. Razorpay is wired for
// Instant's own billing, not as a feature customers can charge their
// students with, so claiming it here would be inventing a product.
// ============================================================

/**
 * Hero — the banner runs the full width, as on the D2C page.
 *
 * This photograph needs something the D2C one did not. That had an
 * empty teal half to put words on; this is busy edge to edge —
 * students left, the teacher centre, a bright screen right — so there
 * is no clear area to drop white text onto.
 *
 * Hence a gradient, and a gradient rather than the flat wash a blanket
 * overlay lays over everything: it is solid behind the copy on the
 * left and gone by two thirds across, so the teacher and the screen
 * stay exactly as shot. Without it the headline is legible or not
 * depending on which student it lands on.
 *
 * `object-left` holds the students under the copy as the frame
 * narrows, which is what keeps the text off the bright screen on a
 * phone.
 */
export function EducationHero() {
  return (
    <section className="relative -mt-19 flex min-h-[70vh] items-center overflow-hidden bg-[#0e4f55] pt-19 sm:-mt-20 sm:pt-20">
      {/* `alt=""` — decorative. The headline in front says what the page
          is about; describing the classroom would only repeat it. */}
      <Image
        src="/images/industries/education-hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-left"
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[#07373c] via-[#07373c]/80 to-transparent lg:to-65%"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-xl text-white">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-xs font-bold backdrop-blur-sm">
            <GraduationCap className="size-3.5" />
            Coaching &amp; Education
          </span>

          <h1 className="lp2-display mt-6 text-4xl leading-[1.08] font-extrabold text-balance sm:text-5xl">
            Every enquiry answered, every parent kept in the loop
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-pretty text-white/80 sm:text-xl">
            Admissions enquiries arrive at nine at night and go cold by
            morning. Instant answers them while you sleep, keeps the whole
            conversation on one record, and sends the batch and fee
            reminders nobody has time to type.
          </p>

          <div className="mt-9">
            <Btn href="/signup">
              Start free trial — 14 days
              <ArrowRight className="size-5" strokeWidth={2.75} />
            </Btn>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The three-up, in the landing page's card rather than the shared
 * FeatureTrio.
 *
 * Forked rather than restyled: FeatureTrio is what the four
 * /features/* pages use, and changing it to suit this page would
 * restyle all of them.
 *
 * `bg-[var(--wa-white,#fff)]` and not `bg-white`, because whatsapp.css
 * repaints `section.bg-white` to the cream canvas — the plain utility
 * renders cream here. The fallback keeps it white under the playful
 * design, which has no --wa-white.
 *
 * `lp2-hard-shadow` carries no styling of its own. It is the opt-out
 * from that same file's blanket `box-shadow: none !important`, and
 * without it the shadow is stripped with nothing to explain why.
 */
export function EducationTrio() {
  const points = [
    {
      icon: MessageCircle,
      title: 'Enquiries answered at once',
      body: 'An ad click or a form opens a WhatsApp thread, and Maya replies with fees, batches and timings before the parent has moved on.',
    },
    {
      icon: ClipboardCheck,
      title: 'Admissions on a board',
      body: 'Every enquiry moves through your own stages — enquired, counselled, documents in, enrolled — with the whole chat inside the record.',
    },
    {
      icon: CalendarClock,
      title: 'Reminders that go out',
      body: 'Class timings, fee dates, exam schedules and holiday notices, sent to the right batch on WhatsApp rather than a notice board.',
    },
  ];

  return (
    <section className="bg-[var(--wa-white,#ffffff)] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-3">
          {points.map((p) => (
            <div
              key={p.title}
              className="lp2-hard-shadow flex flex-col rounded-[25px] bg-white p-7 shadow-[4px_4px_0_2px_rgba(0,0,0,0.05)] sm:p-8"
            >
              <span
                className="flex size-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'var(--lp2-sky-soft)' }}
              >
                <p.icon
                  className="size-5"
                  style={{ color: 'var(--lp2-sky)' }}
                  strokeWidth={2.5}
                />
              </span>
              <p className="lp2-display mt-5 text-lg font-extrabold">
                {p.title}
              </p>
              <p className="mt-2.5 flex-1 text-base leading-relaxed text-(--lp2-ink-soft)">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * A still of the real inbox, not an illustration of one.
 *
 * The shapes are lifted from components/inbox: bubbles are
 * `rounded-2xl` with the sending corner tucked to `rounded-br-md` /
 * `rounded-bl-md`, outbound sits on `bg-primary` and inbound on
 * `bg-muted`, timestamps are 11px, and the avatar is a 44px circle
 * with the channel mark ringed at its corner. Those are the app's own
 * tokens, so this tracks the product if the theme moves.
 *
 * Static by design. It is a picture of the product on a marketing
 * page, not a working inbox, and nothing here is interactive.
 */
function InboxMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-(--lp2-ink)/10 bg-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.25)]">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b border-(--lp2-ink)/10 px-4 py-3">
        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-(--lp2-sky-soft) text-sm font-semibold text-(--lp2-ink)">
          RS
          <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-white ring-2 ring-white">
            <MessageCircle className="size-3 text-(--wa-green,#25d366)" strokeWidth={2.5} />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">Riya Sharma</span>
          <span className="block truncate text-xs text-(--lp2-ink-soft)">
            +91 98••• ••210 · WhatsApp
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-(--lp2-sky-soft) px-2.5 py-1 text-[11px] font-semibold">
          Maya
        </span>
      </div>

      {/* Thread */}
      <div className="space-y-2.5 bg-(--lp2-cream)/50 px-4 py-4">
        <div className="flex flex-col items-start">
          <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-(--lp2-ink)/[0.06] px-3.5 py-2.5">
            <p className="text-sm leading-relaxed">
              Is the NEET weekend batch still open?
            </p>
            <p className="mt-1 text-[11px] text-(--lp2-ink-soft)">10:02 pm</p>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[oklch(0.446_0.127_146)] px-3.5 py-2.5 text-white">
            <p className="text-sm leading-relaxed">
              It is — Saturdays and Sundays, 9am to 1pm, starting the 12th.
              Shall I book a counselling call?
            </p>
            <p className="mt-1 text-right text-[11px] text-white/70">10:02 pm</p>
          </div>
          <span className="mt-1 text-[11px] font-medium text-(--lp2-ink-soft)">
            Answered by Maya
          </span>
        </div>

        <div className="flex flex-col items-start">
          <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-(--lp2-ink)/[0.06] px-3.5 py-2.5">
            <p className="text-sm leading-relaxed">Yes, Sunday evening works</p>
            <p className="mt-1 text-[11px] text-(--lp2-ink-soft)">10:03 pm</p>
          </div>
        </div>
      </div>

      {/* Composer */}
      <div className="flex items-center gap-2 border-t border-(--lp2-ink)/10 px-4 py-3">
        <span className="flex-1 truncate rounded-full bg-(--lp2-ink)/[0.05] px-3.5 py-2 text-sm text-(--lp2-ink-soft)">
          Type a message
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[oklch(0.446_0.127_146)]">
          <ArrowRight className="size-4 text-white" strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );
}

export function EducationCapture() {
  return (
    <FeatureSplit
      hue="sky"
      title="The enquiry that arrives at 10pm"
      highlight="at 10pm"
      body="Admissions run on speed. A parent comparing three institutes will usually go with whoever answered. Maya answers in seconds from your own prospectus, and brings a person in the moment the question needs one."
      points={[
        'Click-to-WhatsApp ads land the enquiry straight in your inbox',
        'Maya replies from your own fee structure, syllabus and batch timings',
        'Qualifying questions asked and the answers written onto the contact',
        'Handed to a counsellor the moment it needs a human',
      ]}
      visual={<InboxMock />}
    />
  );
}

export function EducationAdmissions() {
  return (
    <FeatureSplit
      hue="grape"
      flip
      title="From first enquiry to enrolled, on one board"
      highlight="on one board"
      body="An admission is a sequence, not a message. Name your own stages, drag the enquiry through them, and keep every conversation, document and note on the student record as it moves."
      points={[
        'Stages you name yourself — enquired, counselled, documents, enrolled',
        'The whole WhatsApp thread lives inside the record, not a separate tool',
        'Custom fields for course, batch, board and the parent’s number',
        'Follow-ups fire automatically when a stage goes quiet',
      ]}
      visual={
        <div className="rounded-2xl border-2 border-(--lp2-ink) bg-white p-5 shadow-(--lp2-shadow-sm)">
          <div className="grid grid-cols-2 gap-3">
            {[
              { stage: 'Enquired', count: '18' },
              { stage: 'Counselled', count: '11' },
              { stage: 'Documents in', count: '6' },
              { stage: 'Enrolled', count: '4' },
            ].map((c) => (
              <div
                key={c.stage}
                className="rounded-xl border-2 border-(--lp2-ink)/15 bg-(--lp2-cream) px-4 py-3"
              >
                <p className="text-2xl leading-none font-extrabold">
                  {c.count}
                </p>
                <p className="mt-1.5 text-xs font-bold text-(--lp2-ink-soft)">
                  {c.stage}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs font-medium text-(--lp2-ink-soft)">
            An illustration of the board, not live data.
          </p>
        </div>
      }
    />
  );
}

export function EducationGrid() {
  return (
    <FeatureGrid
      hue="sky"
      title="The term-time jobs nobody has time for"
      highlight="nobody has time for"
      subtitle="Once students are enrolled, the work turns into keeping everyone told. That part automates well."
      items={[
        {
          title: 'Batch-wise broadcasts',
          body: 'Segment by course, batch or year, and send a timetable change to exactly that group on an approved template.',
        },
        {
          title: 'Fee reminders',
          body: 'A scheduled reminder before the date and a follow-up after it, sent on WhatsApp where it is actually read.',
        },
        {
          title: 'Parents kept in the loop',
          body: 'Store the parent’s number alongside the student’s and send attendance, results and notices to both.',
        },
        {
          title: 'Demo and counselling bookings',
          body: 'Flows that collect a slot in the chat, so nobody plays phone tag to arrange a fifteen-minute call.',
        },
        {
          title: 'One inbox for the front desk',
          body: 'WhatsApp, Instagram and Messenger together, with assignment and internal notes so two people never answer the same parent.',
        },
        {
          title: 'Your number, your bill',
          body: 'You connect on your own WhatsApp Business Account. Meta bills you directly, at Meta’s published rates.',
        },
      ]}
    />
  );
}

/**
 * The black band, reusing the homepage's stats tabs rather than a
 * second implementation of the same thing. Same component, same
 * markup, education copy in the panels.
 *
 * It stays black while the rest of the page runs white — that
 * contrast is the point of the band, and `.industry-white` does not
 * touch it because the rule only rewrites `section.bg-white`.
 */
export function EducationFacts() {
  const stats: WaStat[] = [
    {
      value: '0%',
      label: 'Reseller markup',
      note: 'Meta bills you at Meta’s own rates',
      detail:
        'You connect on your own WhatsApp Business Account, so Meta invoices you directly at its published rates. We never sit in the middle of a conversation or take a cut of one — you pay a flat plan fee and nothing per message.',
      href: '/pricing',
    },
    {
      value: '3',
      label: 'Channels, one inbox',
      note: 'WhatsApp, Instagram and Messenger',
      detail:
        'A parent who asks on Instagram and follows up on WhatsApp is one conversation with one history, not three strangers in three tabs. Your front desk answers all of it from the same place.',
      href: '/features/shared-inbox',
    },
    {
      value: '14',
      label: 'Days free',
      note: 'Every feature, no card',
      detail:
        'The whole product for fourteen days — every channel, every automation, Maya included. No card up front, and nothing switches off mid-trial to make a point.',
      href: '/pricing',
    },
  ];

  return (
    <section className="bg-black px-6 py-20 text-white sm:py-24">
      <div className="mx-auto max-w-[1080px]">
        <WaStatsTabs stats={stats} />
      </div>
    </section>
  );
}
