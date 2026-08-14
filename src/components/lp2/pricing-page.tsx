import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, Check, Minus, Plus, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { DotField, Highlight, Sparkle } from './decor';
import { Btn, SectionHead } from './ui';

// ============================================================
// /pricing — the dedicated pricing page.
//
// The three-card plan block lives in `pricing.tsx` and is rendered at
// the top of this page. The landing page no longer carries it — plans
// are only shown here, reached from the nav and the footer. This file
// adds what doesn't fit next to the cards: the flat-fee argument, and
// a full feature-by-feature matrix.
//
// The matrix numbers are transcribed from the live `billing_plans`
// rows — seats, contacts and storage come from each plan's `limits`
// jsonb, and every ✓/✗ below maps to one of the `allow_*` flags that
// `entitlements.ts` actually enforces at runtime. Nothing here is
// aspirational: if a tick is wrong, the gate is wrong. Re-check both
// when a plan's limits change.
// ============================================================

/* ═══════════════════════════ Hero ═══════════════════════════════ */

export function PricingHero() {
  return (
    <section className="relative -mt-19 overflow-hidden bg-(--lp2-mint) pt-19 sm:-mt-20 sm:pt-20">
      <DotField />

      <div className="relative mx-auto max-w-4xl px-4 pt-14 pb-20 text-center sm:px-6 sm:pt-20 sm:pb-24">
        <span
          className="inline-flex items-center gap-2 rounded-full border-2 border-(--lp2-ink) bg-white px-3.5 py-1.5 text-xs font-bold shadow-(--lp2-shadow-sm)"
          style={{ transform: 'rotate(-1.5deg)' }}
        >
          <Sparkle color="lemon" className="size-3.5" />
          14-day trial · no card · cancel any time
        </span>

        <h1 className="lp2-display mt-6 text-4xl leading-[1.08] font-extrabold text-balance sm:text-6xl">
          One flat fee. <Highlight color="lemon">Never</Highlight> per message.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
          Pick a plan for the size of your team, not the size of your send.
          Meta bills your WhatsApp account directly for the messages you send,
          at Meta&rsquo;s own published rates — we never mark those up, resell
          them as credits, or take a cut of your volume.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Btn href="/signup">
            Start free trial
            <ArrowRight className="size-5" strokeWidth={2.75} />
          </Btn>
          <Btn href="#compare-plans" variant="plain">
            Compare plans
          </Btn>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════ The no-per-message argument ════════════════ */

const ELSEWHERE = [
  'A markup on top of Meta’s conversation rates, kept by the vendor',
  'Prepaid “message credits” that expire at the end of the month',
  'Per-contact, per-campaign or per-AI-reply add-ons on the invoice',
  'A bigger bill every time a campaign does well',
];

const HERE = [
  'One flat monthly fee, whatever your volume does',
  'Meta charges your WhatsApp account directly, at Meta’s rates',
  'Unlimited campaigns, replies and AI answers inside your plan',
  'Seats and contacts are the only ladder — not messages',
];

export function PricingNoPerMessage() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead
          hue="lemon"
          title="Your best month shouldn't be your biggest invoice."
          highlight="biggest invoice"
          subtitle="Most WhatsApp platforms sit between you and Meta and take a cut of every conversation. We don't sit there at all — your messages are billed by Meta, to you, at Meta's rates."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Panel
            tone="bad"
            title="What you'll often find elsewhere"
            items={ELSEWHERE}
          />
          <Panel tone="good" title="What you'll find here" items={HERE} />
        </div>

        {/* The honest caveat, stated plainly rather than buried — a
            pricing page that implies WhatsApp itself is free would get
            found out at the first invoice. */}
        <p className="mx-auto mt-10 max-w-3xl rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-lemon-soft) px-6 py-5 text-center text-sm leading-relaxed font-semibold">
          To be clear: WhatsApp itself is not free. Meta charges for the
          messages you send, with rates that vary by country and message
          category. Those go to Meta on your own WhatsApp Business Account —
          they never pass through us, so there is nothing for us to inflate.
          Read the detail in our{' '}
          <Link href="/terms" className="underline underline-offset-2">
            terms
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

function Panel({
  tone,
  title,
  items,
}: {
  tone: 'good' | 'bad';
  title: string;
  items: string[];
}) {
  const good = tone === 'good';

  return (
    <div
      className="rounded-2xl border-2 border-(--lp2-ink) p-6 shadow-(--lp2-shadow) sm:p-7"
      style={{
        backgroundColor: good ? 'var(--lp2-mint)' : 'var(--lp2-coral-soft)',
      }}
    >
      <h3 className="lp2-display text-2xl font-extrabold">{title}</h3>

      <ul className="mt-5 space-y-3.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span
              className={cn(
                'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-(--lp2-ink)',
                good ? 'bg-(--lp2-grass) text-white' : 'bg-(--lp2-coral)',
              )}
            >
              {good ? (
                <Check className="size-3.5" strokeWidth={4} />
              ) : (
                <X className="size-3.5" strokeWidth={4} />
              )}
            </span>
            <span className="text-sm leading-relaxed font-semibold text-pretty">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══════════════════════ Plan comparison ════════════════════════ */

/** A matrix cell: `true`/`false` draw a tick or a cross, a string is
 *  printed as-is (limits, and the billing rows where "None" is the
 *  point). */
type MatrixCell = boolean | string;

type MatrixRow = { feature: string; cells: [MatrixCell, MatrixCell, MatrixCell] };

const PLAN_COLUMNS = [
  { name: 'Try', price: '₹100', hue: 'sky', featured: false },
  { name: 'Pro', price: '₹999', hue: 'lemon', featured: true },
  { name: 'Business', price: '₹2,499', hue: 'grape', featured: false },
] as const;

const GROUPS: { group: string; rows: MatrixRow[] }[] = [
  {
    group: 'What you get',
    rows: [
      { feature: 'Team members', cells: ['2', '10', 'Unlimited'] },
      { feature: 'Contacts', cells: ['60', '25,000', 'Unlimited'] },
      { feature: 'Media storage', cells: ['10 MB', '5 GB', '20 GB'] },
      { feature: 'WhatsApp numbers', cells: ['1', '1', '1'] },
    ],
  },
  {
    group: 'In every plan',
    rows: [
      { feature: 'Shared team inbox', cells: [true, true, true] },
      { feature: 'Contacts, tags & custom fields', cells: [true, true, true] },
      { feature: 'Templates & broadcast campaigns', cells: [true, true, true] },
      { feature: 'Campaign analytics', cells: [true, true, true] },
      { feature: 'Sales pipelines & deals', cells: [true, true, true] },
      { feature: 'AI agent with your knowledge base', cells: [true, true, true] },
    ],
  },
  {
    group: 'As you grow',
    rows: [
      { feature: 'No-code automations', cells: [false, true, true] },
      { feature: 'Flows — the visual chatbot builder', cells: [false, true, true] },
      { feature: 'WhatsApp calling', cells: [false, true, true] },
      { feature: 'Instagram & Messenger channels', cells: [false, true, true] },
      { feature: 'REST API, API keys & webhooks', cells: [false, true, true] },
    ],
  },
  {
    group: 'Billing',
    rows: [
      { feature: 'Charges from us per message', cells: ['None', 'None', 'None'] },
      { feature: 'Charges from us per contact', cells: ['None', 'None', 'None'] },
      {
        feature: 'Meta’s own message charges',
        cells: ['Billed by Meta', 'Billed by Meta', 'Billed by Meta'],
      },
      { feature: 'Free trial', cells: ['14 days', '14 days', '14 days'] },
      { feature: 'Minimum term', cells: ['None', 'None', 'None'] },
    ],
  },
];

// One column template, shared by the heading row and every body row —
// they have to agree or the ticks stop lining up under their plan.
const COLS = 'sm:grid-cols-[1.6fr_1fr_1fr_1fr]';

// The card is rounded-2xl (16px) over a 2px border, so corner cells need
// 14px to follow the curve.
const CORNER = '14px';

export function PricingMatrix() {
  return (
    <section
      id="compare-plans"
      className="scroll-mt-28 bg-(--lp2-sky-soft) py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead
          hue="sky"
          title="Every plan, line by line."
          highlight="line by line"
          subtitle="The whole product is in every plan. What changes as you move up is how many people can use it, how many contacts you can keep, and whether the automation tools are switched on."
        />

        <div className="relative mt-14 rounded-2xl border-2 border-(--lp2-ink) bg-white shadow-(--lp2-shadow-lg)">
          {/* Plan headings. Hidden on mobile, where each row prints its
              own plan labels instead. */}
          <div className={cn('hidden sm:grid', COLS)}>
            <div
              className="bg-(--lp2-cream)"
              style={{ borderTopLeftRadius: CORNER }}
            />
            {PLAN_COLUMNS.map((plan, i) => (
              <div
                key={plan.name}
                className={cn(
                  'relative border-l-2 border-(--lp2-ink) px-4 py-6 text-center',
                  plan.featured ? 'bg-(--lp2-mint)' : 'bg-(--lp2-cream)',
                )}
                style={
                  i === PLAN_COLUMNS.length - 1
                    ? { borderTopRightRadius: CORNER }
                    : undefined
                }
              >
                {plan.featured && (
                  <span className="absolute top-0 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-b-lg bg-(--lp2-coral) px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white uppercase">
                    <Sparkle color="lemon" className="size-2.5" />
                    Most loved
                  </span>
                )}
                <p className="lp2-display mt-3 text-lg font-extrabold">
                  {plan.name}
                </p>
                <p className="mt-1 flex items-baseline justify-center gap-1">
                  <span className="lp2-display text-2xl font-extrabold">
                    {plan.price}
                  </span>
                  <span className="text-xs font-bold text-(--lp2-ink-soft)">
                    /mo
                  </span>
                </p>
                <Link
                  href="/signup"
                  className={cn(
                    'mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg border-2 border-(--lp2-ink) text-xs font-extrabold transition-transform duration-150 hover:-translate-y-0.5',
                    plan.featured
                      ? 'bg-(--lp2-grass) text-white'
                      : 'bg-white',
                  )}
                >
                  Start free
                </Link>
              </div>
            ))}
          </div>

          {GROUPS.map((section, gi) => (
            <div key={section.group}>
              <p
                className={cn(
                  'border-t-2 border-(--lp2-ink) bg-(--lp2-ink) px-5 py-2.5 text-xs font-extrabold tracking-wide text-white uppercase',
                  // On mobile the plan headings are gone, so the very
                  // first band *is* the card's top edge and has to take
                  // its corners. On desktop it sits mid-card, where a
                  // radius would notch it — hence `max-sm:`, not the
                  // inline style the always-cornered cells use.
                  gi === 0 &&
                    'max-sm:rounded-t-[14px] max-sm:border-t-0',
                )}
              >
                {section.group}
              </p>

              {section.rows.map((row) => (
                <div
                  key={row.feature}
                  className={cn('grid border-t-2 border-(--lp2-ink)/15', COLS)}
                >
                  <div className="flex items-center bg-(--lp2-cream) px-5 py-3 sm:py-3.5">
                    <p className="text-sm font-extrabold text-pretty">
                      {row.feature}
                    </p>
                  </div>
                  {row.cells.map((cell, i) => (
                    <MatrixValue
                      key={PLAN_COLUMNS[i].name}
                      cell={cell}
                      plan={PLAN_COLUMNS[i].name}
                      featured={PLAN_COLUMNS[i].featured}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}

          <div
            className="flex flex-col items-center gap-4 border-t-2 border-(--lp2-ink) bg-(--lp2-cream) px-5 py-6 text-center sm:flex-row sm:justify-between sm:text-left"
            style={{
              borderBottomLeftRadius: CORNER,
              borderBottomRightRadius: CORNER,
            }}
          >
            <p className="text-sm font-semibold text-(--lp2-ink-soft)">
              All prices in INR, billed monthly. Change or cancel your plan
              whenever you like — your contacts and history stay yours.
            </p>
            <Btn href="/signup" className="h-12 shrink-0 px-6 text-sm">
              Start free trial
            </Btn>
          </div>
        </div>
      </div>
    </section>
  );
}

function MatrixValue({
  cell,
  plan,
  featured,
}: {
  cell: MatrixCell;
  /** Printed on mobile, where the stacked cells have no heading above
   *  them; screen-reader-only from `sm` up. */
  plan: string;
  featured: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 border-t-2 border-(--lp2-ink)/10 px-5 py-2.5 sm:justify-center sm:border-t-0 sm:border-l-2 sm:border-(--lp2-ink)/15 sm:py-3.5',
        featured && 'bg-(--lp2-mint)/40',
      )}
    >
      <span className="w-20 shrink-0 text-[10px] font-extrabold tracking-wide text-(--lp2-ink-soft) uppercase sm:sr-only sm:w-auto">
        {plan}
      </span>

      {typeof cell === 'string' ? (
        <span className="text-sm font-bold">{cell}</span>
      ) : cell ? (
        <span className="flex size-5 items-center justify-center rounded-full bg-(--lp2-grass) text-white">
          <Check className="size-3" strokeWidth={4} />
          <span className="sr-only">Included</span>
        </span>
      ) : (
        <span className="flex size-5 items-center justify-center rounded-full bg-(--lp2-ink)/10 text-(--lp2-ink-soft)">
          <Minus className="size-3" strokeWidth={4} />
          <span className="sr-only">Not included</span>
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════ Billing FAQ ════════════════════════ */

const BILLING_FAQS = [
  {
    hue: 'pop',
    q: 'Do you charge per message?',
    a: 'No — not per message, not per conversation, not per contact. You pay one flat monthly fee for your plan and that is the entire bill from us, whether you send fifty messages a month or fifty thousand.',
  },
  {
    hue: 'lemon',
    q: 'So messaging on WhatsApp is free?',
    a: 'Messaging is not free, but the charge is Meta’s and it goes straight to Meta. Rates depend on the country you are messaging and the category of message you send, and they are billed to your own WhatsApp Business Account. We add nothing on top and take no cut, so there is no margin for us in your volume.',
  },
  {
    hue: 'coral',
    q: 'What does the trial include?',
    a: 'Fourteen days with every feature switched on, and no card required to start. When it ends, pick a plan to keep sending — your data, contacts and history stay untouched either way.',
  },
  {
    hue: 'sky',
    q: 'Can I change plans later?',
    a: 'Yes. Move up or down from Settings → Plan whenever your team changes shape. Nothing is deleted when you switch — if a lower plan has a smaller contact limit, your existing contacts stay, you just can’t add past the cap until you upgrade again.',
  },
  {
    hue: 'grape',
    q: 'How do payments work?',
    a: 'Checkout runs through Razorpay in INR — cards, UPI and the usual Indian payment methods. Only an admin or owner can complete a purchase, your plan goes live the moment payment clears, and every payment produces an invoice you can download from your account.',
  },
  {
    hue: 'tangerine',
    q: 'What if I want a refund?',
    a: 'There is no minimum term — cancel any time and you will not be charged again. See our cancellation and refunds policy for how in-period refunds are handled.',
  },
] as const;

export function PricingFaq() {
  return (
    <section className="bg-(--lp2-grape-soft) py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHead
          hue="pop"
          title="The awkward questions, answered first."
          highlight="answered first"
        />

        <div className="mt-12 space-y-3">
          {BILLING_FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-xl border-2 border-(--lp2-ink) bg-white"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-base font-bold [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="size-3.5 shrink-0 rounded-full"
                  style={
                    { backgroundColor: `var(--lp2-${f.hue})` } as CSSProperties
                  }
                />
                <span className="flex-1 text-pretty">{f.q}</span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--lp2-cream) transition-transform duration-200 group-open:rotate-45">
                  <Plus className="size-4" strokeWidth={3} />
                </span>
              </summary>
              <p className="border-t border-(--lp2-ink)/10 px-5 py-4 text-sm leading-relaxed text-(--lp2-ink-soft)">
                {f.a}
              </p>
            </details>
          ))}
        </div>

        <p className="mt-8 text-center text-sm font-semibold text-(--lp2-ink-soft)">
          Still unsure?{' '}
          <Link href="/contact" className="underline underline-offset-2">
            Ask us anything
          </Link>{' '}
          — a person answers.
        </p>
      </div>
    </section>
  );
}
