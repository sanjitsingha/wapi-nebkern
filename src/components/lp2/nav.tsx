'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lp2Announce } from './announce';
import { ArrowRight, ChevronDown, Menu, MessageCircle, X } from 'lucide-react';

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
// Two entries are special-cased on desktop, where they open a panel
// instead of navigating: `Features` (the mega-menu) and `Resources`
// (the small dropdown). Both stay in this array because the mobile
// sheet still renders them — Features as a plain link to the section,
// Resources with its children listed underneath, since a phone has no
// room for a hover panel but does have room for three more rows.
const NAV: {
  label: string;
  href: string;
  hue: Lp2Hue;
  /** Rendered as a dropdown on desktop, indented rows on mobile. */
  children?: { label: string; desc: string; href: string }[];
}[] = [
  { label: 'Features', href: '/#features', hue: 'lemon' },
  { label: 'Autopilot', href: '/autopilot', hue: 'grape' },
  { label: 'Pricing', href: '/pricing', hue: 'sky' },
  {
    label: 'Resources',
    // The parent is a real destination too, not a dead label — on
    // mobile it is tappable, and a dropdown whose trigger goes nowhere
    // is a trap for anyone navigating by keyboard or touch.
    href: '/blog',
    hue: 'coral',
    children: [
      { label: 'Blog', desc: 'Playbooks and product news', href: '/blog' },
      { label: 'Docs', desc: 'Every feature, documented', href: '/docs' },
      {
        label: 'QR Generator',
        desc: 'Free WhatsApp QR codes',
        href: '/qr-generator',
      },
    ],
  },
  // The form, not /contact — that one is the compliance document
  // (registered address, Grievance Officer) and links here anyway.
  { label: 'Contact us', href: '/contact-us', hue: 'mint' },
];

/**
 * The Features mega-menu.
 *
 * A flat list of capabilities in four columns. It used to group them
 * under headings ("Engage", "Autopilot", "Grow", "Organize"), each with
 * a coloured dot and every item behind a tinted icon tile — a lot of
 * decoration standing between someone and the eight links they came for.
 * The headings were also our vocabulary, not the reader's: nobody
 * arrives looking for the "Engage" section.
 *
 * Now it is just the eight things, named and described. The grid still
 * gives it shape; the colour has gone back to the page, where it earns
 * its place.
 */
const FEATURE_MENU: { label: string; desc: string; href: string }[] = [
  {
    label: 'Shared Team Inbox',
    desc: 'One inbox, the whole team',
    href: '/docs/inbox',
  },
  {
    label: 'Multi-channel',
    desc: 'WhatsApp, Instagram & Messenger',
    href: '/docs/whatsapp',
  },
  {
    label: 'AI Bot & Automations',
    desc: 'Replies that run themselves',
    href: '/autopilot',
  },
  {
    label: 'Visual Flow builder',
    desc: 'Branch every conversation',
    href: '/docs/flows',
  },
  {
    label: 'Broadcast Campaigns',
    desc: 'Bulk template sends',
    href: '/docs/campaigns',
  },
  {
    label: 'Segments & Lists',
    desc: 'Target the right people',
    href: '/docs/segments-and-lists',
  },
  {
    label: 'Contacts & CRM',
    desc: 'Every lead you own',
    href: '/docs/contacts',
  },
  {
    label: 'Sales Pipelines',
    desc: 'Drag deals to close',
    href: '/docs/pipelines',
  },
];

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      {/* Was an outlined tile that rotated on hover, with a lemon dot
          stuck on the corner to make it "a character". Now just the
          mark: a solid rounded square, no outline, no dot, no tilt. */}
      <span className="flex size-8 items-center justify-center rounded-lg bg-(--lp2-grass)">
        <MessageCircle className="size-4.5 text-white" strokeWidth={2.5} />
      </span>
      <span className="lp2-display text-xl font-extrabold tracking-tight">
        Instant
      </span>
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
        // No lift, no outline appearing on hover — just a soft wash, the
        // same as the plain nav links beside it.
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-base font-semibold transition-colors duration-150 outline-none group-focus-within/feat:bg-(--lp2-ink)/5 group-hover/feat:bg-(--lp2-ink)/5"
      >
        Features
        <ChevronDown
          className="size-4 transition-transform duration-200 group-focus-within/feat:rotate-180 group-hover/feat:rotate-180"
          strokeWidth={2.25}
        />
      </button>

      {/* inset-x-0 + top-full → spans the full bar width, below it. The
          pt-2 is a transparent bridge across the visible gap. */}
      <div className="invisible absolute inset-x-0 top-full z-40 translate-y-1 pt-2 opacity-0 transition-all duration-150 group-focus-within/feat:visible group-focus-within/feat:translate-y-0 group-focus-within/feat:opacity-100 group-hover/feat:visible group-hover/feat:translate-y-0 group-hover/feat:opacity-100">
        {/* A hairline border and a plain white card. The old panel had a
            2px ink outline, a 24px radius and a hard offset shadow —
            sticker treatment, which suited the floating pill but reads
            as loud hanging off a flush bar. */}
        <div className="rounded-2xl border border-(--lp2-ink)/12 bg-white p-2">
          <div className="grid grid-cols-4 gap-1">
            {FEATURE_MENU.map((it) => (
              <Link
                key={it.label}
                href={it.href}
                className="rounded-xl px-3 py-2.5 transition-colors hover:bg-(--lp2-cream)"
              >
                <span className="block text-base font-bold">{it.label}</span>
                <span className="mt-0.5 block text-base leading-snug text-(--lp2-ink-soft)">
                  {it.desc}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The Resources dropdown.
 *
 * Same CSS-only mechanism as FeaturesMenu — `group-hover` plus
 * `group-focus-within`, with a transparent `pt-2` bridge so the pointer
 * can cross the visible gap without the panel closing under it.
 *
 * Unlike Features this one is `relative` and narrow: three links do not
 * want the full width of the bar, and a full-bleed panel hanging off a
 * short word looks like a mistake.
 */
function ResourcesMenu({
  items,
}: {
  items: { label: string; desc: string; href: string }[];
}) {
  return (
    <div className="group/res relative">
      <button
        type="button"
        aria-haspopup="true"
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-base font-semibold transition-colors duration-150 outline-none group-focus-within/res:bg-(--lp2-ink)/5 group-hover/res:bg-(--lp2-ink)/5"
      >
        Resources
        <ChevronDown
          className="size-4 transition-transform duration-200 group-focus-within/res:rotate-180 group-hover/res:rotate-180"
          strokeWidth={2.25}
        />
      </button>

      <div className="invisible absolute top-full left-1/2 z-40 w-64 -translate-x-1/2 translate-y-1 pt-2 opacity-0 transition-all duration-150 group-focus-within/res:visible group-focus-within/res:translate-y-0 group-focus-within/res:opacity-100 group-hover/res:visible group-hover/res:translate-y-0 group-hover/res:opacity-100">
        <div className="rounded-2xl border border-(--lp2-ink)/12 bg-white p-2">
          {items.map((it) => (
            <Link
              key={it.label}
              href={it.href}
              className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-(--lp2-cream)"
            >
              <span className="block text-base font-bold">{it.label}</span>
              <span className="mt-0.5 block text-base leading-snug text-(--lp2-ink-soft)">
                {it.desc}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Lp2Nav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-(--lp2-ink)/12 bg-(--lp2-cream)/85 backdrop-blur-md">
      <Lp2Announce />
        {/* `relative` is the positioning anchor the full-width Features
          mega-menu resolves its `inset-x-0` against — see FeaturesMenu. */}
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div>
            <Logo />
          </div>

          <nav className="hidden items-center gap-3 lg:flex">
            {NAV.map((item) =>
              item.label === 'Features' ? (
                <FeaturesMenu key="features" />
              ) : item.children ? (
                <ResourcesMenu key={item.label} items={item.children} />
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  // Each link used to hover into its own colour, lift half
                  // a pixel and grow a 2px outline. Five different hover
                  // colours in one row is a lot of personality for a nav
                  // bar whose job is to get out of the way; one quiet wash
                  // does the same work. The hues live on in the mobile
                  // sheet's bullets, where they identify rather than shout.
                  className="rounded-lg px-3 py-2 text-base font-semibold transition-colors duration-150 outline-none hover:bg-(--lp2-ink)/5 focus-visible:bg-(--lp2-ink)/5"
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2 text-base font-semibold transition-colors hover:bg-(--lp2-ink)/5 sm:inline-flex"
            >
              Log in
            </Link>

            {/* The one element still allowed to be emphatic. It keeps its
              solid fill because it is the point of the page — but the
              ink outline and offset shadow are gone, so it reads as a
              button rather than a sticker. */}
            <Link
              href="/signup"
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-lg bg-(--lp2-grass) px-4 text-base font-bold text-white transition-colors hover:bg-(--lp2-ink)',
                press
              )}
            >
              Start free
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </Link>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? 'Close menu' : 'Open menu'}
              className={cn(
                'flex size-10 items-center justify-center rounded-lg border border-(--lp2-ink)/15 transition-colors hover:bg-(--lp2-ink)/5 lg:hidden',
                press
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

        {/* Mobile sheet. Inside the same sticky header so it travels on
          scroll, but now it drops from the bar's underside rather than
          floating below a pill — so it gets the bar's full width and a
          top rule instead of its own outline. */}
        {open && (
          <div className="border-t border-(--lp2-ink)/12 bg-white lg:hidden">
            <ul className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
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

                  {/* Children listed flat rather than behind a toggle.
                      Three rows is less tapping than an accordion, and
                      the sheet is already a scrolling list. Indented to
                      the parent's label, past the bullet. */}
                  {item.children && (
                    <ul className="mb-1 ml-8 space-y-0.5 border-l-2 border-(--lp2-ink)/10 pl-3">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={() => setOpen(false)}
                            className="block rounded-xl px-3 py-2 text-lg font-semibold text-(--lp2-ink-soft) transition-colors hover:bg-(--lp2-cream) hover:text-(--lp2-ink)"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>

            <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex h-12 items-center justify-center rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-mint) text-base font-bold sm:hidden"
              >
                Log in
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
