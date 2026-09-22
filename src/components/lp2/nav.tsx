'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lp2Announce } from './announce';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';

import { Magnetic } from '@/components/ui/magnetic-button';
import { BrandLogo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';
import { type Lp2Hue } from './decor';
import { hardShadowButton, press } from './ui';

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
  children?: { label: string; href: string }[];
}[] = [
  { label: 'Features', href: '/#features', hue: 'lemon' },
  { label: 'Pricing', href: '/pricing', hue: 'sky' },
  {
    label: 'Resources',
    // The parent is a real destination too, not a dead label — on
    // mobile it is tappable, and a dropdown whose trigger goes nowhere
    // is a trap for anyone navigating by keyboard or touch.
    href: '/blog',
    hue: 'coral',
    children: [
      { label: 'Blog', href: '/blog' },
      { label: 'Docs', href: '/docs' },
      { label: 'QR Generator', href: '/qr-generator' },
    ],
  },
  // The form, not /contact — that one is the compliance document
  // (registered address, Grievance Officer) and links here anyway.
  { label: 'Contact us', href: '/contact-us', hue: 'mint' },
];

/**
 * The Features dropdown.
 *
 * Five entries, not eight, and every one goes to a page written to sell
 * that surface. It used to list eight and send most of them into
 * /docs/* — documentation, which answers "how do I configure this" for
 * someone who already bought. A visitor in the nav has not bought yet,
 * and eight choices where three are near-synonyms ("Multi-channel" vs
 * "Shared Team Inbox", "Contacts & CRM" vs "Sales Pipelines") is a menu
 * that makes them work out our product structure before they can click.
 *
 * The cut ones are not gone from the site — multi-channel is the first
 * thing the inbox page argues, CRM is the record under the pipelines
 * page. They stopped being separate doors.
 *
 * Automations & Flows points at /ask-maya rather than a page of its
 * own: that page already covers both in full, and a second one would
 * compete with it for the same search.
 */
const FEATURE_MENU: { label: string; href: string }[] = [
  { label: 'Shared Team Inbox', href: '/features/shared-inbox' },
  { label: 'Broadcast Campaigns', href: '/features/campaigns' },
  { label: 'Automations & Flows', href: '/ask-maya' },
  { label: 'Segments & Lists', href: '/features/segments' },
  { label: 'Sales Pipelines', href: '/features/pipelines' },
];

function Logo() {
  return (
    <Link href="/" className="group flex items-center">
      {/* Mark and wordmark in one image. This replaced a rounded tile
          with a chat glyph beside the word "Instant" set in the display
          face — a stand-in that matched neither the real lockup's
          proportions nor its green. */}
      <BrandLogo priority className="h-8" />
    </Link>
  );
}

/**
 * Features trigger + hover/focus dropdown.
 *
 * CSS-only, driven by `group-hover` and `group-focus-within` on the
 * wrapper — no state, and it opens on keyboard focus too. Two details
 * make it behave:
 *
 *  - The panel sits at `top-full` with a transparent `pt-2` bridge, so
 *    the visible gap between the trigger and the card is still part of
 *    the hover target — the pointer can't fall through it and dismiss
 *    the menu on the way down.
 *  - The trigger's own lit state keys off `group-hover/feat`, not its
 *    own `:hover`, so it stays highlighted while you're down in the
 *    panel rather than going dark the moment the pointer leaves it.
 *
 * A vertical list of single-line labels hung under the word, the same
 * shape as Resources. It used to be a full-bar mega-menu with a label
 * and a one-line description per item, side by side in five columns.
 */


/**
 * Entrance for a nav dropdown, in two beats.
 *
 *  1. The card slides DOWN into place: it starts 16px above its resting
 *     spot, transparent, and drops and fades in over 350ms — noticeably
 *     quicker than the list, so the container is there first.
 *  2. As the card lands, the list inside it rises UP 20px and fades in
 *     as one group over a slower 700ms, starting 250ms in. The card
 *     clips it (`overflow-hidden`), so the list surfaces inside the card
 *     rather than sliding over its edge.
 *
 * Opposite directions on purpose: the card arrives from the trigger
 * above it, and the content settles up into the card.
 *
 * Both run on the same long ease-out — quick to start, slow to settle.
 * The long durations and the delay live only on the open state
 * (`group-hover` / `group-focus-within`); closing uses a short 200ms
 * fade with no delay, so the menu gets out of the way promptly.
 *
 * The open-state classes are written out once per menu rather than
 * built from the group name: Tailwind only generates classes it can read
 * literally in the source.
 */
const DROPDOWN_CARD_MOTION =
  'invisible -translate-y-4 opacity-0 transition-[opacity,translate,visibility] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:translate-y-0 motion-reduce:transition-none';

const FEATURES_CARD_OPEN =
  'group-hover/feat:visible group-hover/feat:translate-y-0 group-hover/feat:opacity-100 group-hover/feat:duration-350 group-focus-within/feat:visible group-focus-within/feat:translate-y-0 group-focus-within/feat:opacity-100 group-focus-within/feat:duration-350';

const RESOURCES_CARD_OPEN =
  'group-hover/res:visible group-hover/res:translate-y-0 group-hover/res:opacity-100 group-hover/res:duration-350 group-focus-within/res:visible group-focus-within/res:translate-y-0 group-focus-within/res:opacity-100 group-focus-within/res:duration-350';

const DROPDOWN_LIST_MOTION =
  'translate-y-5 opacity-0 transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:translate-y-0 motion-reduce:transition-none';

const FEATURES_LIST_OPEN =
  'group-hover/feat:translate-y-0 group-hover/feat:opacity-100 group-hover/feat:duration-700 group-hover/feat:delay-250 group-focus-within/feat:translate-y-0 group-focus-within/feat:opacity-100 group-focus-within/feat:duration-700 group-focus-within/feat:delay-250';

const RESOURCES_LIST_OPEN =
  'group-hover/res:translate-y-0 group-hover/res:opacity-100 group-hover/res:duration-700 group-hover/res:delay-250 group-focus-within/res:translate-y-0 group-focus-within/res:opacity-100 group-focus-within/res:duration-700 group-focus-within/res:delay-250';

/** One row in a nav dropdown. Taller than before (py-3) and spaced with
 *  a gap on the list, so the labels do not crowd each other. */
const DROPDOWN_ROW =
  'block rounded-xl px-3 py-3 text-base font-bold transition-colors hover:bg-(--lp2-cream)';

function FeaturesMenu() {
  return (
    <div className="group/feat relative">
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

      {/* Left-aligned to the trigger rather than centred on it: Features
          is the first item in the row, and a wide panel centred on it
          would push out past the logo. The pt-2 is a transparent bridge
          across the visible gap. */}
      <div
        className={cn(
          'absolute top-full left-0 z-40 w-64 pt-2',
          DROPDOWN_CARD_MOTION,
          FEATURES_CARD_OPEN,
        )}
      >
        {/* A hairline border and a white card with a soft, blurred drop
            shadow to lift it off the page — not the sticker outline and
            hard offset shadow. `lp2-dropdown` exempts it from the
            WhatsApp design's no-shadow rule (whatsapp.css). */}
        <div className="lp2-dropdown overflow-hidden rounded-2xl border border-(--lp2-ink)/12 bg-white p-2.5 shadow-[0_16px_40px_-12px_rgba(28,30,33,0.22),0_2px_8px_rgba(28,30,33,0.06)]">
          <div className={cn('flex flex-col gap-1.5', DROPDOWN_LIST_MOTION, FEATURES_LIST_OPEN)}>
            {FEATURE_MENU.map((it) => (
              <Link key={it.label} href={it.href} className={DROPDOWN_ROW}>
                {it.label}
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
  active,
}: {
  items: { label: string; href: string }[];
  active?: boolean;
}) {
  return (
    <div className="group/res relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-1 rounded-lg px-3 py-2 text-base font-semibold transition-colors duration-150 outline-none group-focus-within/res:bg-(--lp2-ink)/5 group-hover/res:bg-(--lp2-ink)/5',
          active && 'bg-(--lp2-ink)/8 text-(--lp2-ink)',
        )}
      >
        Resources
        <ChevronDown
          className="size-4 transition-transform duration-200 group-focus-within/res:rotate-180 group-hover/res:rotate-180"
          strokeWidth={2.25}
        />
      </button>

      <div
        className={cn(
          'absolute top-full left-1/2 z-40 w-64 -translate-x-1/2 pt-2',
          DROPDOWN_CARD_MOTION,
          RESOURCES_CARD_OPEN,
        )}
      >
        {/* Same card and shadow as the Features dropdown. */}
        <div className="lp2-dropdown overflow-hidden rounded-2xl border border-(--lp2-ink)/12 bg-white p-2.5 shadow-[0_16px_40px_-12px_rgba(28,30,33,0.22),0_2px_8px_rgba(28,30,33,0.06)]">
          <div className={cn('flex flex-col gap-1.5', DROPDOWN_LIST_MOTION, RESOURCES_LIST_OPEN)}>
            {items.map((it) => (
              <Link key={it.label} href={it.href} className={DROPDOWN_ROW}>
                {it.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Lp2Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // A link is "active" when the current path is it or sits under it.
  // Home/anchor links (href '/#…' → base '/') never light up — they're
  // section jumps, not a page you can be "on".
  const isActive = (href: string) => {
    const base = href.split('#')[0];
    if (!base || base === '/') return false;
    return pathname === base || pathname.startsWith(base + '/');
  };
  const isGroupActive = (item: (typeof NAV)[number]) =>
    isActive(item.href) || !!item.children?.some((c) => isActive(c.href));

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
                <ResourcesMenu
                  key={item.label}
                  items={item.children}
                  active={isGroupActive(item)}
                />
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  // Each link used to hover into its own colour, lift half
                  // a pixel and grow a 2px outline. Five different hover
                  // colours in one row is a lot of personality for a nav
                  // bar whose job is to get out of the way; one quiet wash
                  // does the same work. The hues live on in the mobile
                  // sheet's bullets, where they identify rather than shout.
                  //
                  // The active page keeps a permanent wash and a yellow
                  // underline — the one place the palette still earns a
                  // job on desktop.
                  style={
                    isActive(item.href)
                      ? { textDecorationColor: 'var(--lp2-lemon)' }
                      : undefined
                  }
                  className={cn(
                    'rounded-lg px-3 py-2 text-base font-semibold transition-colors duration-150 outline-none hover:bg-(--lp2-ink)/5 focus-visible:bg-(--lp2-ink)/5',
                    isActive(item.href) &&
                      'text-(--lp2-ink) underline decoration-2 underline-offset-[6px]',
                  )}
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

            {/* The one element still allowed to be emphatic — but it earns
              it on hover rather than shouting at rest. Idle, it is an
              outline on the nav's own background. Hovered (or focused
              from the keyboard), it fills with the brand green and throws
              a hard, unblurred black shadow 4px down and right.
              `lp2-hard-shadow` exempts that shadow from the WhatsApp
              design's no-shadow rule (whatsapp.css). */}
            <Magnetic>
              <Link
                href="/signup"
                className={hardShadowButton}
              >
                Start free
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </Link>
            </Magnetic>

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
              {NAV.map((item) => {
                const active = isGroupActive(item);
                return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-3 py-3 text-base font-bold transition-colors hover:bg-(--lp2-cream)',
                      active && 'bg-(--lp2-ink)/8',
                    )}
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
                            aria-current={isActive(child.href) ? 'page' : undefined}
                            className={cn(
                              'block rounded-xl px-3 py-2 text-lg font-semibold text-(--lp2-ink-soft) transition-colors hover:bg-(--lp2-cream) hover:text-(--lp2-ink)',
                              isActive(child.href) &&
                                'bg-(--lp2-cream) text-(--lp2-ink)',
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
                );
              })}
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
