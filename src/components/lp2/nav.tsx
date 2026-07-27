'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  ChevronDown,
  Inbox,
  KanbanSquare,
  Megaphone,
  Menu,
  MessageCircle,
  Users,
  UserSquare,
  Workflow,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Lp2Hue } from './decor';
import { press } from './ui';

// ============================================================
// /lp-2 navigation — a floating pill rather than a full-bleed bar.
//
// A bar pinned edge to edge would cut the page in two and flatten the
// cream canvas; a rounded pill with an ink outline and a hard shadow
// sits *on* the page like everything else here, and lets the blobs
// behind it stay visible.
//
// Client component only because of the mobile menu's open state — the
// desktop nav is otherwise static markup.
// ============================================================

/**
 * Each link owns a hue, used for its hover wash and its bullet in the
 * mobile sheet. It's the cheapest possible bit of joy: the nav is the
 * first thing anyone touches, and one that answers back in a different
 * colour every time sets the tone for the whole page.
 */
// Anchors are absolute (`/#features`) because this nav also renders on
// the legal and blog pages, where a bare `#features` goes nowhere.
//
// `Features` is special-cased: on desktop it opens the mega-menu below
// (FeaturesMenu) instead of navigating. It stays in this array so the
// mobile sheet still lists it as a plain link — the sheet has no room
// for a nested panel, and its links jump to the same page anyway.
const NAV: { label: string; href: string; hue: Lp2Hue }[] = [
  { label: 'Features', href: '/#features', hue: 'lemon' },
  { label: 'AI Agents', href: '/#ai-agents', hue: 'grape' },
  { label: 'Pricing', href: '/#pricing', hue: 'sky' },
  { label: 'Docs', href: '/docs', hue: 'coral' },
  { label: 'Blog', href: '/blog', hue: 'tangerine' },
];

/**
 * The Features mega-menu — the major capabilities, grouped by what the
 * customer is trying to do, same taxonomy as the live site's header so
 * the two stay recognisable. Each item carries its own hue and icon;
 * that per-item colour is the whole reason this is worth more than a
 * plain link on a joyful page.
 */
const FEATURE_MENU: {
  heading: string;
  hue: Lp2Hue;
  items: { label: string; desc: string; href: string; icon: LucideIcon }[];
}[] = [
  {
    heading: 'Engage',
    hue: 'sky',
    items: [
      { label: 'Shared Team Inbox', desc: 'One inbox, the whole team', href: '/docs/inbox', icon: Inbox },
      { label: 'Multi-channel', desc: 'WhatsApp, IG & Messenger', href: '/docs/whatsapp', icon: MessageCircle },
    ],
  },
  {
    heading: 'Automate',
    hue: 'grape',
    items: [
      { label: 'AI Agents', desc: 'Answer & qualify 24/7', href: '/docs/ai-agents', icon: Bot },
      { label: 'No-code Flows', desc: 'Automate every follow-up', href: '/docs/flows', icon: Workflow },
    ],
  },
  {
    heading: 'Grow',
    hue: 'coral',
    items: [
      { label: 'Broadcast Campaigns', desc: 'Bulk template sends', href: '/docs/campaigns', icon: Megaphone },
      { label: 'Segments & Lists', desc: 'Target the right people', href: '/docs/segments-and-lists', icon: Users },
    ],
  },
  {
    heading: 'Organize',
    hue: 'tangerine',
    items: [
      { label: 'Contacts & CRM', desc: 'Every lead you own', href: '/docs/contacts', icon: UserSquare },
      { label: 'Sales Pipelines', desc: 'Drag deals to close', href: '/docs/pipelines', icon: KanbanSquare },
    ],
  },
];

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="relative">
        <span className="flex size-9 items-center justify-center rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-grass) transition-transform duration-200 group-hover:-rotate-6">
          <MessageCircle className="size-4.5 text-white" strokeWidth={2.75} />
        </span>
        {/* The dot that makes the mark feel like a character rather
            than an icon in a box. */}
        <span className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-(--lp2-ink) bg-(--lp2-lemon)" />
      </span>
      <span className="lp2-display text-xl font-extrabold">wacrm</span>
    </Link>
  );
}

/**
 * Features trigger + hover/focus mega-menu.
 *
 * CSS-only, driven by `group-hover` and `group-focus-within` on the
 * wrapper — no state, and it opens on keyboard focus too. Two details
 * make it behave:
 *
 *  - The panel sits at `top-full` with a transparent `pt-4` bridge, so
 *    the visible gap between the pill and the card is still part of the
 *    hover target — the pointer can't fall through it and dismiss the
 *    menu on the way down.
 *  - The trigger's own lit state keys off `group-hover/feat`, not its
 *    own `:hover`, so it stays highlighted while you're down in the
 *    panel rather than going dark the moment the pointer leaves it.
 *
 * Full-width: the wrapper is `static` (not relative), so the panel's
 * `absolute inset-x-0` resolves against the nav pill (the nearest
 * positioned ancestor — it carries `relative` for exactly this), giving
 * a mega-menu that spans the whole bar instead of a card hung under one
 * word.
 */
function FeaturesMenu() {
  return (
    <div className="group/feat static">
      <button
        type="button"
        aria-haspopup="true"
        style={
          { '--nav-hue': 'var(--lp2-lemon-soft)' } as React.CSSProperties
        }
        className="flex items-center gap-1 rounded-full border-2 border-transparent px-3.5 py-2 text-sm font-bold transition-all duration-150 outline-none group-hover/feat:-translate-y-0.5 group-hover/feat:border-(--lp2-ink) group-hover/feat:bg-(--nav-hue) group-focus-within/feat:border-(--lp2-ink) group-focus-within/feat:bg-(--nav-hue)"
      >
        Features
        <ChevronDown
          className="size-4 transition-transform duration-200 group-hover/feat:rotate-180 group-focus-within/feat:rotate-180"
          strokeWidth={2.75}
        />
      </button>

      {/* inset-x-0 + top-full → spans the full pill width, below it. The
          pt-4 is a transparent bridge across the visible gap. */}
      <div className="invisible absolute inset-x-0 top-full z-40 translate-y-1 pt-4 opacity-0 transition-all duration-200 group-hover/feat:visible group-hover/feat:translate-y-0 group-hover/feat:opacity-100 group-focus-within/feat:visible group-focus-within/feat:translate-y-0 group-focus-within/feat:opacity-100">
        <div className="rounded-3xl border-2 border-(--lp2-ink) bg-white p-4 shadow-(--lp2-shadow-lg)">
          {/* Four columns across the full width — one per group, same
              taxonomy the live site uses. */}
          <div className="grid grid-cols-4 gap-x-3 gap-y-2">
            {FEATURE_MENU.map((col) => (
              <div key={col.heading}>
                <p className="mb-1 flex items-center gap-1.5 px-2 text-[11px] font-extrabold tracking-wide uppercase text-(--lp2-ink-soft)">
                  <span
                    aria-hidden
                    className="size-2 rounded-full border-2 border-(--lp2-ink)"
                    style={{ backgroundColor: `var(--lp2-${col.hue})` }}
                  />
                  {col.heading}
                </p>
                <ul>
                  {col.items.map((it) => (
                    <li key={it.label}>
                      <Link
                        href={it.href}
                        className="flex items-start gap-2.5 rounded-2xl p-2 transition-colors hover:bg-(--lp2-cream)"
                      >
                        <span
                          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `var(--lp2-${col.hue}-soft)` }}
                        >
                          <it.icon className="size-4" strokeWidth={2.5} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">
                            {it.label}
                          </span>
                          <span className="block text-xs leading-snug text-(--lp2-ink-soft)">
                            {it.desc}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Lp2Nav() {
  const [open, setOpen] = useState(false);

  return (
    // `top-3` not `top-0`: a floating pill needs air above it, or it
    // reads as a bar that failed to reach the edge.
    <header className="sticky top-3 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      {/* `relative` is the positioning anchor the full-width Features
          mega-menu resolves its `inset-x-0` against — see FeaturesMenu. */}
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between rounded-full border-2 border-(--lp2-ink) bg-white/85 px-3 shadow-(--lp2-shadow-sm) backdrop-blur-md sm:px-4">
        <div className="pl-1">
          <Logo />
        </div>

        <nav className="hidden items-center gap-3 lg:flex">
          {NAV.map((item) =>
            item.label === 'Features' ? (
              <FeaturesMenu key="features" />
            ) : (
              <Link
                key={item.label}
                href={item.href}
                // The per-item hue rides in on a CSS var so one static
                // utility can paint five different colours — Tailwind
                // can't generate a class for a value it never sees, and
                // a JS mouse handler would skip keyboard focus.
                style={
                  {
                    '--nav-hue': `var(--lp2-${item.hue}-soft)`,
                  } as React.CSSProperties
                }
                className="rounded-full border-2 border-transparent px-3.5 py-2 text-sm font-bold transition-all duration-150 outline-none hover:-translate-y-0.5 hover:border-(--lp2-ink) hover:bg-(--nav-hue) focus-visible:border-(--lp2-ink) focus-visible:bg-(--nav-hue)"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-2 text-sm font-bold transition-colors hover:bg-(--lp2-mint) sm:inline-flex"
          >
            Log in
          </Link>

          <Link
            href="/signup"
            className={cn(
              'inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-(--lp2-ink) bg-(--lp2-grass) px-5 text-sm font-bold text-white shadow-(--lp2-shadow-sm)',
              press,
            )}
          >
            Start free
            <ArrowRight className="size-4" strokeWidth={2.75} />
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className={cn(
              'flex size-11 items-center justify-center rounded-full border-2 border-(--lp2-ink) bg-(--lp2-lemon) shadow-(--lp2-shadow-sm) lg:hidden',
              press,
            )}
          >
            {open ? (
              <X className="size-5" strokeWidth={2.75} />
            ) : (
              <Menu className="size-5" strokeWidth={2.75} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile sheet. Rendered under the pill and inside the same
          sticky header, so it travels with it on scroll. */}
      {open && (
        <div className="mx-auto mt-3 max-w-6xl rounded-3xl border-2 border-(--lp2-ink) bg-white p-3 shadow-(--lp2-shadow) lg:hidden">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-base font-bold transition-colors hover:bg-(--lp2-cream)"
                >
                  <span
                    aria-hidden
                    className="size-3.5 rounded-full border-2 border-(--lp2-ink)"
                    style={{ backgroundColor: `var(--lp2-${item.hue})` }}
                  />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="mt-2 flex h-12 items-center justify-center rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-mint) text-sm font-bold sm:hidden"
          >
            Log in
          </Link>
        </div>
      )}
    </header>
  );
}
