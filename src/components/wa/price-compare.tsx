import Image from 'next/image';

import { BrandLogo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';
import { waType } from './ui';

// ============================================================
// What the software costs, next to three other Indian WhatsApp API
// platforms.
//
// ── The rule ──
//
// Every figure here was read from that platform's own pricing page on
// CHECKED_ON, and nothing is converted, averaged or inferred. Where a
// platform does not publish a number, the cell says so. That is not a
// gap in the research — WATI prices in USD behind a script, and
// AiSensy publishes its add-ons but not its base plans — and writing
// "from ₹X" in those cells would be inventing a competitor's price on
// our own homepage.
//
// Currencies are left as each platform states them. A rupee figure for
// WhatChimp would be today's FX rate baked into a page that outlives
// it.
//
// ── One finding worth keeping in view ──
//
// All three state they add no markup on Meta's conversation rates, the
// same as Instant. On this table that row is a level, not a win, and
// it is rendered as one.
// ============================================================

/** The day every rival figure below was read from its own pricing page. */
const CHECKED_ON = '25–26 September 2026';

interface Col {
  name: string;
  /**
   * The wordmark for the header, when we have the file. Optional: a
   * column without one falls back to its name, so the table never
   * waits on an asset. Only Instant and Interakt are on disk today —
   * drop a PNG in public/images/compare and add it here.
   */
  logo?: { src: string; width: number; height: number };
  /**
   * Height class for this mark. The four lockups have different
   * proportions — Instant is about 4.2:1, Interakt 3:1 — so one shared
   * height draws them at noticeably different widths. Sizing each to
   * land near the same *width* is what reads as balanced.
   */
  logoClass?: string;
  /** Ours renders in ink; the rest sit back in muted grey. */
  us?: boolean;
  cells: string[];
}

const ROWS = [
  'Cheapest plan with WhatsApp',
  'AI replies',
  'People on that plan',
  'Meta’s message charges',
  'Free trial',
];

const COLS: Col[] = [
  {
    name: 'Instant',
    us: true,
    cells: [
      '₹499/mo',
      'Included from ₹799/mo, unlimited',
      '1 on Starter, the team from Growth',
      'Billed by Meta at Meta’s rates',
      '14 days, no card',
    ],
  },
  {
    name: 'WATI',
    logo: { src: '/images/compare/wati.svg', width: 1440, height: 490 },
    cells: [
      'Priced in USD, not shown on their pricing page',
      'Chatbot builder included; Astra AI Agents are an add-on',
      '3 on Growth, and it takes no extras',
      'No markup stated',
      '7 days',
    ],
  },
  {
    name: 'AiSensy',
    logo: { src: '/images/compare/aisensy.webp', width: 904, height: 253 },
    logoClass: 'h-7 w-auto',
    cells: [
      'Base plans not published',
      'Chatbot builder ₹2,500/mo; AI Agent ₹1,350/mo',
      'Unlimited users',
      'Meta’s rates, credits bought separately',
      'Not published',
    ],
  },
  {
    name: 'Interakt',
    logo: { src: '/images/compare/interakt.png', width: 3750, height: 1249 },
    logoClass: 'h-8 w-auto',
    cells: [
      '₹2,799/mo + taxes. The free Starter plan is Instagram only',
      '₹2,499/mo add-on — 100 messages, then ₹0.50 each',
      'Unlimited agents',
      'No markup stated',
      'Offered; length not published',
    ],
  },
];

/**
 * The table, in the card the rest of this page uses: white on the cream
 * canvas, 25px tile radius, hard shadow.
 *
 * `lp2-hard-shadow` carries no styling of its own — it is the opt-out
 * from whatsapp.css's blanket `box-shadow: none !important`, without
 * which the shadow is stripped and nothing renders.
 *
 * Four columns will not fit a phone, so the card scrolls sideways below
 * `lg` with a min-width holding the grid together, rather than being
 * reflowed into four stacked blocks that lose the comparison.
 */
export function WaPriceCompare() {
  return (
    <section className="scroll-mt-24 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-[1080px]">
        <h2 className={cn(waType.displayMd, 'max-w-[760px] text-balance')}>
          What the software costs, side by side
        </h2>
        <p
          className={cn(
            waType.bodyLg,
            'mt-6 max-w-[680px] text-pretty text-(--wa-ink-muted)',
          )}
        >
          Every platform here runs on the same official WhatsApp Business API,
          so Meta’s per-message charges are the same wherever you go. What
          differs is the monthly software fee — and whether the AI costs extra.
        </p>

        <div className="lp2-hard-shadow mt-12 overflow-x-auto rounded-[25px] bg-white shadow-[4px_4px_0_2px_rgba(0,0,0,0.05)]">
          <div className="min-w-[860px] p-7 sm:p-8">
            {/* Header */}
            <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr_1fr] gap-4 pb-5">
              <span />
              {COLS.map((col) => (
                <span key={col.name} className="flex items-center">
                  {col.us ? (
                    <BrandLogo className="h-6" />
                  ) : col.logo ? (
                    <Image
                      src={col.logo.src}
                      alt={col.name}
                      width={col.logo.width}
                      height={col.logo.height}
                      sizes="140px"
                    unoptimized={col.logo.src.endsWith('.svg')}
                      className={col.logoClass ?? 'h-6 w-auto'}
                    />
                  ) : (
                    <span className="text-lg leading-none text-(--wa-ink-muted)">
                      {col.name}
                    </span>
                  )}
                </span>
              ))}
            </div>

            <div className="divide-y divide-(--wa-hairline) border-t border-(--wa-hairline)">
              {ROWS.map((row, i) => (
                <div
                  key={row}
                  className="grid grid-cols-[1.1fr_1fr_1fr_1fr_1fr] gap-4 py-5"
                >
                  <span className={cn(waType.caption, 'text-(--wa-ink-muted)')}>
                    {row}
                  </span>
                  {COLS.map((col) => (
                    <span
                      key={col.name}
                      className={cn(
                        waType.bodyMd,
                        'leading-relaxed',
                        col.us ? 'text-(--wa-ink)' : 'text-(--wa-ink-muted)',
                      )}
                    >
                      {col.cells[i]}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Where the numbers came from. Without this the table is
            unverifiable, and every one of these prices will move. */}
        <p className={cn(waType.caption, 'mt-6 text-(--wa-ink-muted)')}>
          Read from each platform’s own pricing page on {CHECKED_ON} and quoted
          as published — no conversions, and blanks where a platform does not
          publish the figure. Prices change; check theirs before you decide.
        </p>
      </div>
    </section>
  );
}
