'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  ChatBubble,
  MiniCampaign,
  MiniFlow,
  MiniInbox,
  MiniKanban,
  PhoneFrame,
} from './landing-visuals';

// ============================================================
// Interactive tabbed sections for the landing page. Kept in a
// client component so the rest of the page stays server-rendered.
// ============================================================

/**
 * Tabs as a row of bordered cells that reads as the top edge of the
 * panel below it, rather than a floating underline. The active cell is
 * the only one on the card surface — it looks cut out of the strip,
 * which is what connects it to the content.
 *
 * Single row at every width (scrolls horizontally when it must) instead
 * of wrapping into a grid: a wrapped row leaves an empty cell in the
 * last column, and an empty cell in a bordered grid reads as a missing
 * tab rather than as spare space.
 */
function TabBar({
  tabs,
  active,
  onSelect,
  numbered,
  progressive,
  progress = 1,
  className,
}: {
  tabs: readonly string[];
  active: number;
  onSelect: (i: number) => void;
  /** Prefix each label with its position — used for the journey, whose
   *  tabs are sequential stages rather than parallel options. */
  numbered?: boolean;
  /**
   * Treat the tabs as a sequence being worked through: the top rule
   * fills 0→100% across the active tab as it is scrolled, and stays
   * full on everything already passed. Without it the rule is a plain
   * on/off marker for the selected tab.
   */
  progressive?: boolean;
  /** How far through the active tab, 0–1. Only read when `progressive`. */
  progress?: number;
  className?: string;
}) {
  // Horizontal scale of each tab's top rule.
  const fillFor = (i: number) => {
    if (!progressive) return i === active ? 1 : 0;
    if (i < active) return 1;
    return i === active ? progress : 0;
  };

  return (
    <div
      role="tablist"
      className={cn(
        'scrollbar-none border-border flex overflow-x-auto overflow-y-hidden rounded-t-xl border border-b-0',
        className,
      )}
    >
      {tabs.map((t, i) => {
        const isActive = i === active;
        return (
          <button
            key={t}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(i)}
            className={cn(
              'border-border relative min-w-32 flex-1 border-r px-4 py-3 text-left transition-colors last:border-r-0 sm:px-5 sm:py-3.5',
              isActive ? 'bg-[#F6FFEC]' : 'bg-muted/40 hover:bg-muted/70',
            )}
          >
            {/* Accent as an overlay, not a border: a real border-top
                would shift the label down by 2px on selection.
                Driven by scaleX from the left edge rather than width,
                so it stays on the compositor and can be repainted every
                scroll frame without layout work. */}
            <span
              aria-hidden
              className="bg-primary absolute inset-x-0 top-0 h-0.5 origin-left"
              style={{ transform: `scaleX(${fillFor(i)})` }}
            />
            {numbered && (
              <span
                className={cn(
                  'mb-0.5 block text-[10px] font-semibold tabular-nums',
                  isActive ? 'text-primary' : 'text-muted-foreground/60',
                )}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
            )}
            <span
              className={cn(
                'block text-sm font-semibold whitespace-nowrap',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {t}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The panel under the tab strip: copy on the left, product visual on a
 * tinted half to the right, split by a single rule. The tint is what
 * separates "what we say" from "what it looks like" without needing a
 * second border or a drop shadow.
 */
function TabPanel({
  children,
  visual,
  className,
  visualFullBleed,
}: {
  children: React.ReactNode;
  visual: React.ReactNode;
  className?: string;
  /**
   * Let the visual fill its half corner to corner instead of floating,
   * centred, inside padding on the tinted half. For a visual that
   * already carries its own full-bleed background (like Capture's
   * photo) rather than one meant to sit ON the tint (the phone
   * mockups). Defaults to the padded/centred treatment.
   */
  visualFullBleed?: boolean;
}) {
  return (
    // `lg:flex-1` lets the panel absorb whatever height the tab strip
    // leaves over, so tabs + panel together fill the section without
    // overshooting it by the strip's height.
    <div
      className={cn(
        'border-border grid overflow-hidden rounded-b-xl border lg:flex-1 lg:grid-cols-2',
        className,
      )}
    >
      {/* Centred, not top-aligned: in a panel this tall, copy pinned to
          the top leaves a void under it that reads as missing content. */}
      <div className="bg-card flex flex-col justify-center p-7 sm:p-12">
        {children}
      </div>
      <div
        className={cn(
          'border-border bg-primary/5 border-t lg:border-t-0 lg:border-l',
          visualFullBleed
            ? 'overflow-hidden'
            : 'flex items-center justify-center p-7 sm:p-12',
        )}
      >
        {visual}
      </div>
    </div>
  );
}

/* ─── Customer journey: Capture → Qualify → Nurture → Convert → Retain ── */

const JOURNEY = [
  {
    tab: 'Capture',
    title: 'Turn every hello into a contact you own',
    body: 'Every incoming message becomes a contact with full history — no lead left sitting in a personal phone. Import your existing base and keep growing it on autopilot.',
    features: [
      {
        title: 'From your website',
        body: 'Drop a chat button on any page. A click opens a real WhatsApp thread, and the visitor becomes a contact before they have typed a word.',
      },
      {
        title: 'From Meta Messenger',
        body: 'Messages to your Facebook Page arrive in the same shared inbox as everything else — same contact record, same history, no second tab.',
      },
      {
        title: 'From WhatsApp',
        body: 'Every first message on your Business number creates a contact automatically, tagged by how they reached you and ready to route.',
      },
    ],
    visual: (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/landing-page/capture.jpg"
        alt="A Meta ad, a wa.link, and a QR code all funneling into one shared contact list"
        className="h-full w-full object-cover"
      />
    ),
    visualFullBleed: true,
  },
  {
    tab: 'Qualify',
    title: 'Let AI ask the questions and fill your CRM',
    body: 'Your AI agent greets every lead, asks qualifying questions, and writes the answers into contact fields and tags — so your team only spends time on leads that matter.',
    features: [
      {
        title: 'Trained on your own knowledge',
        body: 'Feed it your catalogue, pricing, and policies. It answers from what you actually sell, not from a generic script.',
      },
      {
        title: 'Answers written into fields',
        body: 'Budget, city, timeline — whatever you ask, the reply lands in a custom field on the contact instead of being buried in the thread.',
      },
      {
        title: 'Tagged and routed',
        body: 'Hot leads get tagged the moment they qualify and land with the right teammate, while the rest keep moving without anyone watching.',
      },
    ],
    visual: (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/landing-page/qualify.jpg"
        alt="An AI agent instantly answering a customer's questions in a chat"
        className="h-full w-full object-cover"
      />
    ),
    visualFullBleed: true,
  },
  {
    tab: 'Nurture',
    title: 'Broadcasts that feel personal, at any scale',
    body: 'Segment your audience with tags, lists, and custom fields, then send Meta-approved template campaigns — and watch delivery, read, and reply rates live.',
    features: [
      {
        title: 'Segments that build themselves',
        body: 'Group by tag, list, or any custom field. Rule-based segments keep updating as conversations change, so a send never goes to a stale list.',
      },
      {
        title: 'Meta-approved templates',
        body: 'Draft, submit, and track template approval without leaving the app — then reuse the approved ones across every campaign.',
      },
      {
        title: 'Delivery you can watch live',
        body: 'Delivered, read, and replied, per recipient, as the send goes out. Replies land straight back in the shared inbox.',
      },
    ],
    visual: (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/landing-page/nurture.jpg"
        alt="A broadcast campaign dashboard showing recipients, sent, and delivered counts"
        className="h-full w-full object-cover"
      />
    ),
    visualFullBleed: true,
  },
  {
    tab: 'Convert',
    title: 'A sales pipeline that lives where the deal happens',
    body: 'Drag deals through your own stages while the conversation stays one click away. Assign owners, set values, and never lose track of who is closing what.',
    features: [
      {
        title: 'Your own stages',
        body: 'Build the pipeline around how you actually sell, then drag deals through it. No forced funnel, no fields you will never fill.',
      },
      {
        title: 'Deals tied to the chat',
        body: 'Every card links straight back to the live conversation, so the context behind a number is always one click away.',
      },
      {
        title: 'One clear owner',
        body: 'Assign each deal to a teammate and see instantly what is theirs, what is stalling, and what is about to close.',
      },
    ],
    visual: (
      <div className="w-full max-w-sm space-y-3">
        <MiniKanban />
        <MiniInbox />
      </div>
    ),
    visualFullBleed: false,
  },
  {
    tab: 'Retain',
    title: 'Follow-ups and support that run themselves',
    body: 'Automations trigger on tags, replies, and deal stages to send the right message at the right moment — while support tickets keep every issue on record.',
    features: [
      {
        title: 'No-code flows',
        body: 'Triggers, conditions, and actions on a canvas. Build the follow-up once and it runs on every conversation that matches.',
      },
      {
        title: 'Follow-ups that fire themselves',
        body: 'A tag, a reply, or a deal moving stage can start the next message — so nobody goes quiet just because the team got busy.',
      },
      {
        title: 'Support tickets on record',
        body: 'Turn an issue into a ticket the whole team can see, with the thread attached, so nothing is resolved only in someone DMs.',
      },
    ],
    visual: (
      <div className="w-full max-w-sm space-y-3">
        <MiniFlow />
        <MiniCampaign />
      </div>
    ),
    visualFullBleed: false,
  },
] as const;

/**
 * One capability in a stage: a headline that stands on its own, with
 * the detail folded away until you reach for it.
 *
 * The reveal is a `grid-template-rows: 0fr → 1fr` transition rather
 * than max-height, because it animates to the paragraph's real height —
 * a max-height guess either clips long copy or coasts through dead
 * space before short copy appears.
 *
 * Open by default below `lg` and only collapsible from there up: hover
 * does not exist on touch, so a phone would otherwise show three bare
 * titles and no way to read them.
 */
function ExpandingFeature({ title, body }: { title: string; body: string }) {
  return (
    <div className="group/feat border-border border-t py-5 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-foreground group-hover/feat:text-primary text-[15px] font-semibold transition-colors">
          {title}
        </h4>
        <ChevronDown
          aria-hidden
          className="text-muted-foreground/60 hidden size-4 shrink-0 transition-transform duration-300 lg:block lg:group-hover/feat:rotate-180"
        />
      </div>
      <div
        className={cn(
          'grid grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out',
          'lg:grid-rows-[0fr] lg:group-hover/feat:grid-rows-[1fr] lg:group-focus-within/feat:grid-rows-[1fr]',
        )}
      >
        <div className="overflow-hidden">
          <p className="text-muted-foreground pt-2 text-sm leading-relaxed">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The journey is a SCROLLED story, not a click-to-switch tab view.
 *
 * All five stages render stacked down the page. The strip pins itself
 * under the site header and stays there while they pass beneath it, so
 * the active stage advances as you scroll — Capture, then Qualify, and
 * on. The tabs remain clickable as a jump-to shortcut, but scrolling is
 * the primary interaction.
 *
 * This is why every stage renders rather than only the active one:
 * a scroll narrative needs its content actually laid out down the page,
 * and it also means the whole funnel is in the HTML for crawlers and
 * for anyone without JS, who simply gets five sections and a strip that
 * never highlights.
 */
/** Where the block pins — flush under the site header (h-16 = 64px).
 *  Keep in step with the `top-16` class on the sticky wrapper. */
const STICKY_TOP_PX = 64;

export function JourneyTabs({ heading }: { heading?: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const panelsRef = useRef<(HTMLElement | null)[]>([]);
  const stickyRef = useRef<HTMLDivElement>(null);
  // Which panels currently cross the detection band. Kept in a ref, not
  // state — it changes on every scroll tick and only the derived
  // `active` index is worth a re-render.
  const crossing = useRef<Set<number>>(new Set());

  useEffect(() => {
    const nodes = panelsRef.current.filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const i = nodes.indexOf(entry.target as HTMLElement);
          if (i === -1) continue;
          if (entry.isIntersecting) crossing.current.add(i);
          else crossing.current.delete(i);
        }
        // During a fast scroll two panels can share the band; the
        // upper one wins so the strip never jumps ahead of what is
        // actually filling the screen.
        if (crossing.current.size > 0) {
          setActive(Math.min(...crossing.current));
        }
      },
      // A thin band across the middle of the viewport rather than a
      // threshold: panels are taller than the screen, so "is it 50%
      // visible" never fires for them. Whichever panel crosses the
      // middle owns the strip.
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  /**
   * How far the active stage has been scrolled through, 0–1, driving
   * its tab's top rule.
   *
   * Measured against the same viewport midline the observer uses to
   * pick `active`. That is what makes the handoff seamless: panels are
   * contiguous, so at the instant the next panel's top reaches the
   * midline the current one's bottom is there too — this hits exactly 1
   * as `active` advances and the new tab starts from 0.
   */
  useEffect(() => {
    const panel = panelsRef.current[active];
    if (!panel) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = panel.getBoundingClientRect();
      if (rect.height === 0) return;
      const ratio = (window.innerHeight / 2 - rect.top) / rect.height;
      setProgress(Math.min(1, Math.max(0, ratio)));
    };
    // Coalesce to one measurement per frame — scroll fires far more
    // often than the screen refreshes.
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [active]);

  // Measured rather than a fixed `scroll-mt`: the pinned block includes
  // the heading, whose height changes with how the title wraps, so any
  // hard-coded offset would land the panel behind it at some widths.
  const goTo = useCallback((i: number) => {
    const panel = panelsRef.current[i];
    if (!panel) return;
    const pinnedHeight = stickyRef.current?.getBoundingClientRect().height ?? 0;
    const offset = STICKY_TOP_PX + pinnedHeight;
    window.scrollTo({
      top: window.scrollY + panel.getBoundingClientRect().top - offset,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }, []);

  return (
    <div>
      {/*
        The heading pins WITH the strip — they are one block.

        Pinned FLUSH to the header (top-16 = its h-16) and the gap made
        with `pt-4` inside instead. Sticking lower would leave a live
        strip of page between header and block that scrolling panels
        show through; as padding, the same gap sits behind the block's
        own background and stays clean.

        Opaque for the same reason — a translucent/blurred panel is
        exactly what let content read through. The colour is computed
        rather than picked: the section is `bg-card/40` over the page,
        and --card (pure white) differs from --background (off-white),
        so any single token here would band against the section. Mixing
        the two tokens matches it exactly and follows both themes.

        Negative inline margin extends it over the section's side
        padding, so nothing slides up the gutters uncovered.
      */}
      <div
        ref={stickyRef}
        className="sticky top-16 z-20 -mx-4 bg-[color-mix(in_oklch,var(--card)_40%,var(--background))] px-4 pt-4 pb-4 sm:-mx-6 sm:px-6"
      >
        {heading}
        <TabBar
          tabs={JOURNEY.map((j) => j.tab)}
          active={active}
          onSelect={goTo}
          numbered
          progressive
          progress={progress}
          className="mt-10 rounded-none border"
        />
      </div>

      <div>
        {JOURNEY.map((item, i) => (
          <section
            key={item.tab}
            ref={(el) => {
              panelsRef.current[i] = el;
            }}
            aria-label={item.tab}
            // -mt-px collapses each panel's top border into the edge
            // above it — the strip for the first, the previous panel
            // for the rest — so the stack reads as one continuous box
            // with single hairlines instead of 2px seams.
            className="-mt-px"
          >
            <TabPanel
              visual={item.visual}
              visualFullBleed={item.visualFullBleed}
              className="rounded-none lg:min-h-150"
            >
              <p className="text-primary text-sm font-semibold">
                {String(i + 1).padStart(2, '0')} · {item.tab}
              </p>
              {/* Light weight at a larger size: the panel is big enough
                  that bold at this scale shouts, and the stage number
                  above already carries the emphasis. */}
              <h3 className="mt-5 text-3xl font-light tracking-tight text-balance sm:text-4xl">
                {item.title}
              </h3>
              <p className="text-muted-foreground mt-6 text-base leading-relaxed">
                {item.body}
              </p>
              <div className="mt-10">
                {item.features.map((f) => (
                  <ExpandingFeature key={f.title} title={f.title} body={f.body} />
                ))}
              </div>
            </TabPanel>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ─── Use cases by team: Sales / Marketing / Support ──────────────── */

const TEAMS = [
  {
    tab: 'Sales',
    audience: 'For founders, sales reps & closers',
    title: 'Close deals without leaving the conversation',
    body: 'Qualify with AI, track every deal on a pipeline, and reply from a shared inbox where the whole history is one scroll away.',
    tags: ['Pipelines & deals', 'AI lead qualification', 'Chat assignments', 'Internal notes', 'Contact history'],
    visual: (
      <div className="w-full max-w-sm space-y-3">
        <MiniKanban />
        <MiniInbox />
      </div>
    ),
  },
  {
    tab: 'Marketing',
    audience: 'For growth & campaign managers',
    title: 'Campaigns with open rates email can only dream of',
    body: 'Build segments from real conversation data, launch template broadcasts in minutes, and measure every send down to the reply.',
    tags: ['Broadcast campaigns', 'Segments & lists', 'Template manager', 'Campaign analytics', 'Zapier / Make / n8n'],
    visual: (
      <div className="w-full max-w-sm space-y-3">
        <MiniCampaign />
        <MiniFlow />
      </div>
    ),
  },
  {
    tab: 'Support',
    audience: 'For support teams & operations',
    title: 'Answer instantly, escalate gracefully',
    body: 'Let the AI agent resolve routine questions from your knowledge base and hand the tricky ones to a human — with tickets keeping every issue accountable.',
    tags: ['AI auto-replies', 'Human handoff', 'Support tickets', '24-hour window tracking', 'Team notes'],
    visual: (
      <div className="w-full max-w-sm">
        <PhoneFrame title="Nova Store" subtitle="AI agent · online">
          <ChatBubble side="in" time="18:21">
            Can I return an item after 15 days?
          </ChatBubble>
          <ChatBubble side="out" time="18:21" ai>
            Returns are free within 30 days as long as the tags are on. Want me
            to start a return for you?
          </ChatBubble>
          <ChatBubble side="in" time="18:22">
            It&apos;s a custom order actually
          </ChatBubble>
          <ChatBubble side="out" time="18:22">
            Looping in Priya from our team — she&apos;ll sort this out for you
            right away. 👋
          </ChatBubble>
        </PhoneFrame>
      </div>
    ),
  },
] as const;

export function TeamTabs() {
  const [active, setActive] = useState(0);
  const item = TEAMS[active];

  return (
    <div className="mt-14 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <TabBar
        tabs={TEAMS.map((t) => t.tab)}
        active={active}
        onSelect={setActive}
        className="lg:shrink-0"
      />

      <TabPanel visual={item.visual}>
        <p className="text-primary text-sm font-semibold">{item.audience}</p>
        <h3 className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          {item.title}
        </h3>
        <p className="text-muted-foreground mt-4 text-base leading-relaxed">
          {item.body}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {item.tags.map((t) => (
            <span
              key={t}
              className="border-border text-foreground rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium"
            >
              {t}
            </span>
          ))}
        </div>
        <Link
          href="/signup"
          className="text-primary mt-7 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
        >
          Start free <ArrowRight className="h-4 w-4" />
        </Link>
      </TabPanel>
    </div>
  );
}
