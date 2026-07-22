'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Code2, MessageSquare, Webhook } from 'lucide-react';
import { SiMake, SiN8N, SiZapier } from 'react-icons/si';

import { cn } from '@/lib/utils';

/* ─── Integrations showcase ───────────────────────────────────────────
   Copy on the left, a bracket diagram on the right. Hovering a tool
   swaps the left column over to that tool's detail and back again.

   Why this is a client component: the swap is driven by which row the
   pointer is on, and the alternative — encoding "which of five is
   hovered" in CSS via `group-has-[[data-tool=…]:hover]` — needs five
   hand-written static class strings that Tailwind can see, which is far
   more fragile than one piece of state. Consistent with landing-tabs,
   which is already 'use client' for the same reason.

   Accessibility note: the rows are icon-only, so the tool NAME is
   carried by an aria-label/title on each tile rather than visible text,
   and the longer description is reachable only by hovering. Pointer
   events do fire on tap, so touch users can still surface a panel; what
   they lose is the ability to see a description without interacting.
   Keep the left column's default copy meaningful on its own for that
   reason — it is what a non-hovering visitor actually reads. */

const INTEGRATIONS = [
  {
    name: 'Zapier',
    detail:
      'Kick off a Zap from any wacrm event, or let a Zap create contacts and send messages back the other way. No code on either end.',
    Icon: SiZapier,
    color: '#FF4F00',
  },
  {
    name: 'Make',
    detail:
      'Build scenarios that branch on message content, deal stage, or who a conversation was assigned to — all on a visual canvas.',
    Icon: SiMake,
    color: '#6D00CC',
  },
  {
    name: 'n8n',
    detail:
      'Run the whole pipeline on your own server, so customer data never leaves your infrastructure. Fitting, for a CRM you already host.',
    Icon: SiN8N,
    color: '#EA4B71',
  },
  {
    name: 'Webhooks',
    // Accurate: lib/webhooks/dispatch.ts HMACs every body and sends it
    // as `X-Wacrm-Signature: sha256=…`. Don't soften this to "secure".
    detail:
      'message.received, contact.created, conversation.assigned and deal.stage_changed — each POST HMAC-signed so you can verify it came from us.',
    Icon: Webhook,
    color: null,
  },
  {
    name: 'REST API',
    detail:
      'Issue a key from Settings, then drive contacts and messages from whatever system you already run. Same API our own app uses.',
    Icon: Code2,
    color: null,
  },
] as const;

type Integration = (typeof INTEGRATIONS)[number];

/**
 * Horizontal stagger: each tile sits one step further right than the one
 * above it, so the column reads as a diagonal rather than a straight
 * stack.
 *
 * The step is a CSS variable (`--stagger`, set responsively on the
 * diagram root) rather than a JS constant, because it has to shrink on
 * narrower viewports. At `lg` the 11rem copy gap leaves the tools column
 * only ~320px; five tiles at a wide step would run straight out of it,
 * and there's no clipping to hide that.
 *
 * The same variable drives the bracket branches as a negative `right`,
 * so tiles and their lines always move together.
 */
const stagger = (i: number) => `calc(${i} * var(--stagger))`;
const staggerNeg = (i: number) => `calc(${i} * var(--stagger) * -1)`;

/**
 * Rounded-square icon tile, tinted with the tool's own brand colour.
 *
 * `labelled` carries the tool name as an accessible name. The diagram
 * rows are icon-only, so without it the whole right-hand column would be
 * five unlabelled boxes to a screen reader — the name is only visible in
 * the left panel, and only on hover.
 */
function ToolIcon({
  tool,
  className,
  iconClassName,
  labelled,
}: {
  tool: Integration;
  className?: string;
  iconClassName?: string;
  labelled?: boolean;
}) {
  return (
    <span
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? tool.name : undefined}
      title={labelled ? tool.name : undefined}
      aria-hidden={labelled ? undefined : true}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-2xl',
        // Brand marks get a 10%-opacity wash of their own hue; the two
        // wacrm-native rows fall back to the product's primary.
        !tool.color && 'bg-primary-soft text-primary',
        className,
      )}
      style={
        tool.color
          ? { backgroundColor: `${tool.color}1A`, color: tool.color }
          : undefined
      }
    >
      <tool.Icon className={iconClassName} />
    </span>
  );
}

export function IntegrationShowcase() {
  const [active, setActive] = useState<string | null>(null);

  const n = INTEGRATIONS.length;
  const rowCenter = (i: number) => ((i + 0.5) / n) * 100;
  const first = rowCenter(0);
  const lastRow = rowCenter(n - 1);

  return (
    // `border-x` on the max-w-350 column gives the same vertical rails
    // the hero uses — the section itself stays full-bleed and the rails
    // mark where the content column actually starts and ends.
    <div className="border-border mx-auto grid max-w-350 items-center gap-12 border-x px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-x-44">
      {/* ── Left: default copy, swapped for tool detail on hover ──
          Both panels occupy the SAME grid cell so they crossfade in
          place; the column keeps the height of the taller one, so the
          diagram beside it never shifts as they swap. */}
      <div className="grid">
        <div
          className={cn(
            'col-start-1 row-start-1 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none',
            active
              ? 'pointer-events-none -translate-y-2 opacity-0'
              : 'translate-y-0 opacity-100',
          )}
        >
          <p className="text-primary text-sm font-semibold">Integrations</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Works with the tools you already use
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed text-pretty">
            The moment something happens in wacrm, it leaves as a webhook — so
            the automations you&apos;ve already built can pick it up and run. No
            rebuild, no polling.
          </p>
          <Link
            href="/docs/api-and-integrations"
            className="border-border text-foreground hover:bg-muted mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-5 text-sm font-semibold transition-colors"
          >
            Read the docs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Every tool's panel is rendered, not just the active one, and
            hidden with opacity rather than unmounted. Two reasons: the
            detail copy is then in the server-rendered HTML (indexable,
            and present without JS), and a panel can fade OUT with its
            content intact instead of blanking the instant the pointer
            leaves. The column also settles at the height of the longest
            one, so swapping never nudges the diagram beside it. */}
        {INTEGRATIONS.map((tool) => {
          const isActive = active === tool.name;
          return (
            <div
              key={tool.name}
              aria-hidden={!isActive}
              className={cn(
                'col-start-1 row-start-1 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none',
                isActive
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-2 opacity-0',
              )}
            >
              <ToolIcon tool={tool} className="size-14" iconClassName="size-7" />
              <h3 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
                {tool.name}
              </h3>
              <p className="text-muted-foreground mt-4 text-base leading-relaxed text-pretty">
                {tool.detail}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Right: the diagram ──
          `--stagger` is the per-row horizontal step. It scales with the
          breakpoint because the tools column does: widest at xl+, where
          the copy column and its 11rem gap leave the most room. */}
      <div className="relative [--stagger:24px] lg:[--stagger:48px] xl:[--stagger:80px]">
        {/* Faint graph-paper wash, faded out at the edges so it never
            ends in a hard line. Decorative only. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage:
              'radial-gradient(ellipse at center, black 40%, transparent 78%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at center, black 40%, transparent 78%)',
          }}
        />

        <div className="relative grid grid-cols-[auto_2.5rem_minmax(0,1fr)] items-center sm:grid-cols-[auto_4rem_minmax(0,1fr)]">
          {/* ── Source: the product ── */}
          <div className="bg-card border-border flex size-24 flex-col items-center justify-center gap-1.5 rounded-3xl border shadow-lg sm:size-28">
            <span className="bg-primary relative flex size-11 items-center justify-center rounded-2xl">
              <MessageSquare className="text-primary-foreground size-5.5" />
              {/* Live dot — the section's claim is that events leave the
                  moment they happen, so the source should look awake. */}
              <span className="border-card bg-primary absolute -top-1 -right-1 size-3 rounded-full border-2">
                <span className="bg-primary absolute inset-0 animate-ping rounded-full" />
              </span>
            </span>
            <span className="text-xs font-bold tracking-tight">wacrm</span>
          </div>

          {/* ── Connector: dashed trail, junction, bracket ──
              Built from CSS borders, not an SVG path: the column
              stretches to whatever height the rows end up, and a
              stretched SVG needs preserveAspectRatio="none", which
              scales x and y unequally and turns the rounded corners
              into visible ellipses. Only the animated source→junction
              segment is SVG, and it's horizontal so nothing distorts. */}
          <div aria-hidden className="relative h-full self-stretch">
            <svg
              className="absolute top-1/2 left-0 h-px w-1/2 -translate-y-1/2 overflow-visible"
              viewBox="0 0 10 1"
              preserveAspectRatio="none"
            >
              <line
                x1="0"
                y1="0.5"
                x2="10"
                y2="0.5"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray="2 4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="text-primary/60 animate-trail-flow"
              />
            </svg>

            <span className="border-primary/60 bg-card absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" />

            {/* Each branch overshoots the connector column by exactly
                its row's stagger (negative `right`), so every line still
                lands on the left edge of its tile no matter how far out
                that tile sits. The connector has no overflow clipping,
                which is what lets them reach across. */}
            {/* Upper half of the bracket: vertical run + rounded corner
                into the first row. */}
            <div
              className="border-border absolute left-1/2 rounded-tl-xl border-t border-l"
              style={{
                top: `${first}%`,
                height: `${50 - first}%`,
                right: staggerNeg(0),
              }}
            />
            {/* Lower half. */}
            <div
              className="border-border absolute left-1/2 rounded-bl-xl border-b border-l"
              style={{
                top: '50%',
                height: `${lastRow - 50}%`,
                right: staggerNeg(n - 1),
              }}
            />
            {/* Straight branches for every row between the two ends. */}
            {INTEGRATIONS.slice(1, -1).map((i, idx) => (
              <div
                key={i.name}
                className="border-border absolute left-1/2 border-t"
                style={{
                  top: `${rowCenter(idx + 1)}%`,
                  right: staggerNeg(idx + 1),
                }}
              />
            ))}
          </div>

          {/* ── Tools ──
              The row spacing is PADDING, not a grid `gap`. With equal
              `fr` rows and no gap, row i's centre lands exactly at
              (i + 0.5) / n — which is what the bracket above is drawn
              against. Adding a gap shifts every centre by half a gap and
              the branches stop meeting their rows. Change `py-*` to
              respace; never swap it for `gap-y-*`. */}
          <div className="grid auto-rows-fr">
            {INTEGRATIONS.map((tool, index) => {
              const isActive = active === tool.name;
              return (
                // Icon-only: the tool's name and description live in the
                // left panel, which this row swaps in on hover.
                <div
                  key={tool.name}
                  className="flex items-center py-4"
                  // Stagger via margin, not translate — the hover state
                  // already owns `translate-x`, and stacking the two on
                  // one property means the nudge would cancel the offset.
                  style={{ marginLeft: stagger(index) }}
                  onPointerEnter={() => setActive(tool.name)}
                  // Guarded so a leave event arriving after the pointer
                  // has already entered the next row can't clear it.
                  onPointerLeave={() =>
                    setActive((cur) => (cur === tool.name ? null : cur))
                  }
                >
                  <ToolIcon
                    tool={tool}
                    labelled
                    className={cn(
                      'size-16 transition-[opacity,transform] duration-300 ease-out sm:size-18',
                      'motion-reduce:transform-none motion-reduce:transition-none',
                      isActive && 'translate-x-1 scale-105',
                      // Dim the tiles you're NOT pointing at, so the left
                      // panel's content is unambiguously tied to one.
                      active && !isActive && 'opacity-40',
                    )}
                    iconClassName="size-8 sm:size-9"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
