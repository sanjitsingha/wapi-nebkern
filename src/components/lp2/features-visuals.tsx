import { CheckCheck, GripVertical, Sparkles, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

// ============================================================
// The bento's mini product visuals.
//
// These are miniature screenshots, not icons. They used to be grey
// placeholder bars inside chunky borderless blocks — which reads as a
// wireframe next to a soft gradient, and tells a reader nothing about
// what the product actually looks like.
//
// Each one now carries real content at real density: names, message
// previews, amounts, percentages. The chrome went the other way to make
// room for it — hairline borders instead of solid blocks, 9–11px text
// at medium weight instead of extrabold, and hue accents mixed toward
// white so the gradient behind stays the loudest colour in the card.
//
// Split into its own file because features.tsx was carrying the
// section, the card shell and four sub-components in one.
// ============================================================

const panel = 'rounded-lg border border-(--lp2-ink)/8 bg-white';
const label = 'text-[9px] font-semibold tracking-wide text-(--lp2-ink)/45';

/** Shared team inbox — three live conversations. */
export function MiniInbox() {
  const threads = [
    {
      initials: 'AR',
      hue: 'coral',
      name: 'Aarti Rao',
      preview: 'Do you deliver to Pune?',
      time: '22:47',
      unread: 2,
    },
    {
      initials: 'MK',
      hue: 'sky',
      name: 'Mohit Kapoor',
      preview: 'Can I get last month’s invoice?',
      time: '21:12',
      unread: 0,
    },
    {
      initials: 'JD',
      hue: 'lemon',
      name: 'Jaya Desai',
      preview: 'Is the linen shirt back in stock?',
      time: '19:40',
      unread: 5,
    },
  ] as const;

  return (
    <div className={cn(panel, 'divide-y divide-(--lp2-ink)/6 overflow-hidden')}>
      {threads.map((t) => (
        <div key={t.initials} className="flex items-center gap-2.5 px-3 py-2.5">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
            style={{
              backgroundColor: `color-mix(in oklab, var(--lp2-${t.hue}) 60%, #fff)`,
            }}
          >
            {t.initials}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[11px] font-semibold">
                {t.name}
              </span>
              <span className="shrink-0 text-[9px] text-(--lp2-ink)/40">
                {t.time}
              </span>
            </span>
            <span className="mt-0.5 flex items-center gap-1.5">
              <span className="truncate text-[10px] text-(--lp2-ink)/55">
                {t.preview}
              </span>
              {t.unread > 0 && (
                <span className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-full bg-(--lp2-grass) text-[8px] font-bold text-white">
                  {t.unread}
                </span>
              )}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Broadcast campaigns — one send and its funnel, with real numbers. */
export function MiniCampaign() {
  const rows = [
    { name: 'Delivered', n: '4,182', pct: 98, hue: 'grass' },
    { name: 'Read', n: '3,140', pct: 75, hue: 'sky' },
    { name: 'Replied', n: '612', pct: 15, hue: 'coral' },
  ] as const;

  return (
    <div className={cn(panel, 'p-3')}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold">Diwali Sale</span>
        <span className={label}>sent 2h ago</span>
      </div>

      <div className="mt-2.5 space-y-2">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-baseline justify-between text-[10px]">
              <span className="text-(--lp2-ink)/55">{r.name}</span>
              <span className="font-semibold tabular-nums">{r.n}</span>
            </div>
            {/* A 3px rail rather than a chunky bar chart: this is a
                proportion, and the number beside it is the fact. */}
            <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-(--lp2-ink)/8">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${r.pct}%`,
                  backgroundColor: `var(--lp2-${r.hue})`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2.5 flex items-center gap-1 border-t border-(--lp2-ink)/8 pt-2 text-[9px] font-semibold text-(--lp2-ink)/55">
        <CheckCheck className="size-3 text-(--lp2-sky)" strokeWidth={2.5} />
        4,182 of 4,270 delivered
      </p>
    </div>
  );
}

/** Pipelines & CRM — two stages holding real deals. */
export function MiniKanban() {
  const cols = [
    {
      name: 'New',
      hue: 'lemon',
      deals: [
        { who: 'Nova Store', amt: '₹42,000' },
        { who: 'Urban Threads', amt: '₹18,500' },
      ],
    },
    {
      name: 'Won',
      hue: 'grass',
      deals: [{ who: 'Belle Salon', amt: '₹1,20,000' }],
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2">
      {cols.map((c) => (
        <div key={c.name} className={cn(panel, 'p-2')}>
          <div className="flex items-center gap-1.5 px-0.5">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: `var(--lp2-${c.hue})` }}
            />
            <span className="text-[10px] font-semibold">{c.name}</span>
            <span className="ml-auto text-[9px] text-(--lp2-ink)/40">
              {c.deals.length}
            </span>
          </div>

          <div className="mt-1.5 space-y-1.5">
            {c.deals.map((d) => (
              <div
                key={d.who}
                className="flex items-start gap-1 rounded-md border border-(--lp2-ink)/6 bg-(--lp2-cream)/60 px-1.5 py-1.5"
              >
                <GripVertical className="mt-px size-2.5 shrink-0 text-(--lp2-ink)/20" />
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-semibold">
                    {d.who}
                  </span>
                  <span className="block text-[9px] text-(--lp2-ink)/50 tabular-nums">
                    {d.amt}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Flows & automations — one rule, written the way the builder reads
 *  it, rather than three unexplained icons. */
export function MiniFlow() {
  const steps = [
    {
      kind: 'When',
      hue: 'sky',
      icon: Sparkles,
      text: 'Message contains “price”',
    },
    { kind: 'Then', hue: 'lemon', icon: Zap, text: 'AI sends the price list' },
    {
      kind: 'Then',
      hue: 'grass',
      icon: CheckCheck,
      text: 'Tag “hot lead” · assign to Sales',
    },
  ] as const;

  return (
    <div className={cn(panel, 'p-3')}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold">Price enquiry</span>
        <span className={label}>runs automatically</span>
      </div>

      <div className="mt-2.5">
        {steps.map((s, i) => (
          <div key={s.text}>
            <div className="flex items-center gap-2">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-md"
                style={{
                  backgroundColor: `color-mix(in oklab, var(--lp2-${s.hue}) 55%, #fff)`,
                }}
              >
                <s.icon className="size-3" strokeWidth={2.5} />
              </span>
              <span className="min-w-0">
                <span className={cn(label, 'block uppercase')}>{s.kind}</span>
                <span className="block truncate text-[10px] font-medium">
                  {s.text}
                </span>
              </span>
            </div>

            {/* Connector, omitted after the last step. Sits under the
                icon column so the three read as one chain. */}
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className="my-1 ml-3 block h-2.5 w-px bg-(--lp2-ink)/15"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
