import type { Lp2Hue } from './decor';
import { Highlight } from './decor';
import { SectionHead } from './ui';

// ============================================================
// Features — a spec sheet.
//
// Replaces the scroll-driven tab strip that lived here. Tabs showed one
// tool at a time and made the reader work for the rest; this lays the
// whole surface area out at once, which is what someone comparing
// products actually wants. Term on the left, plain description on the
// right, a hairline between each — closer to a datasheet than a
// marketing card, and it scales as the product grows.
//
// The header goes through `SectionHead` like every other section on the
// page, so the centred title-and-subtitle rhythm holds. Only the rows
// below are left-aligned, because a centred column at this density
// gives the eye no consistent edge to return to.
//
// Deliberately not on a dark ground. The reference this is modelled on
// is white-on-black, but nothing else in this product is, and a single
// inverted section would read as a page borrowed from another site.
// ============================================================

type Feature = { term: string; hue: Lp2Hue; body: string };

/**
 * One flat list — the two columns are a layout decision, not a
 * grouping, so splitting the data would only make reordering harder.
 *
 * Hues rotate through the three lightest in the palette. The deeper
 * ones (sky, grape, grass, coral) carry ink text at roughly 3:1, which
 * `SectionHead` solves by opting into white text at display size — not
 * an option here, where these run at body size and the large-text
 * exemption does not apply.
 */
const FEATURES: Feature[] = [
  {
    term: 'Embedded signup',
    hue: 'lemon',
    body: 'Connect your number through Meta’s own flow, right inside Instant. No agency in the middle, no support ticket, no waiting a week to find out a form was filled in wrong.',
  },
  {
    term: 'Shared team inbox',
    hue: 'mint',
    body: 'WhatsApp, Instagram and Messenger in one thread list. Assign an owner, leave notes your customer never sees, and keep the history with the contact rather than the agent.',
  },
  {
    term: 'Template management',
    hue: 'tangerine',
    body: 'Write, submit and track Meta-approved templates without leaving the app. Approval status lands here, so you learn a template was rejected before a campaign depends on it.',
  },
  {
    term: 'Broadcast campaigns',
    hue: 'lemon',
    body: 'Send an approved template to thousands, filtered by tag, pipeline stage or last activity. Delivery, read and reply rates arrive live rather than in a report next week.',
  },
  {
    term: 'Pipelines & CRM',
    hue: 'mint',
    body: 'Custom fields, tags and drag-and-drop stages wrapped around the conversation itself, so a chat becomes a deal without anyone retyping it into another system.',
  },
  {
    term: 'Flows & automations',
    hue: 'tangerine',
    body: 'No-code triggers, conditions, waits and actions. Greet, qualify, route and follow up at 3am, then hand to a human the moment it stops being routine.',
  },
  {
    term: 'AI agents',
    hue: 'lemon',
    body: 'Answer in seconds from your own documents and past replies, in your own tone. Every answer is logged, and anything the agent is unsure of goes to a person instead of being guessed at.',
  },
  {
    term: 'WhatsApp calling',
    hue: 'mint',
    body: 'Take and place WhatsApp calls from the browser on your approved number. Call history sits beside the chat history, on the same contact record.',
  },
  {
    term: 'Widget, QR & links',
    hue: 'tangerine',
    body: 'Turn a website visitor, a poster or a printed menu into a WhatsApp conversation in one tap. Every entry point is tracked, so you can see which ones actually bring people in.',
  },
  {
    term: 'Webhooks & API',
    hue: 'lemon',
    body: 'Push every message, contact and deal event into your own stack, or drive Instant from it. Your data stays yours, and stays reachable.',
  },
];

export function Lp2Features() {
  return (
    <section id="features" className="scroll-mt-28 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* `max-w-5xl` overrides SectionHead's default `max-w-2xl` (cn
            runs twMerge, so the later class wins). At 44px this title
            needs about 950px to stay on one line, and the default column
            broke it across two. The subtitle is unaffected — it carries
            its own `max-w-2xl` inside, so widening the header does not
            stretch the body copy into an unreadable line length. */}
        <SectionHead
          className="max-w-5xl"
          hue="sky"
          title="Everything you need to sell on WhatsApp"
          highlight="sell on WhatsApp"
          highlightText="white"
          subtitle="Inbox, campaigns, CRM and automations usually mean four tools and four bills. Here they are one product, on the official WhatsApp Business API."
        />

        {/* Two columns on large screens. The gap-x is wide enough that the
            two columns' hairlines never read as one rule across the page. */}
        <div className="mt-16 grid gap-x-16 lg:grid-cols-2">
          {FEATURES.map((f) => (
            <Row key={f.term} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * One term/description pair.
 *
 * The rule sits on top of each row rather than the bottom, so the list
 * ends on text instead of a dangling line. The two `border-t-0` rules
 * strip it from whichever rows are genuinely first: item 1 in a single
 * column, items 1 and 2 once the grid splits in two.
 *
 * The term column is 13rem rather than hugging the text: `Highlight` is
 * `whitespace-nowrap`, so the longest term has to fit unbroken or it
 * pushes into the description. `pr-2` leaves room for the block's
 * offset shadow, which is drawn outside the element's box.
 */
function Row({ feature }: { feature: Feature }) {
  return (
    <div className="grid gap-x-8 gap-y-3 border-t border-(--lp2-ink)/15 py-7 first:border-t-0 sm:grid-cols-[minmax(0,13rem)_1fr] lg:nth-2:border-t-0">
      <h3 className="pr-2 font-bold text-xl">
        <Highlight color={feature.hue}>{feature.term}</Highlight>
      </h3>
      <p className="leading-relaxed text-(--lp2-ink-soft)">{feature.body}</p>
    </div>
  );
}
