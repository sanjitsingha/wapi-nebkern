'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lp2Announce } from './announce';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';

import { BrandLogo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';
import { Sparkle, type Lp2Hue } from './decor';
import { MayaLockup } from './maya-lockup';
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
  { label: 'Ask Maya', href: '/ask-maya', hue: 'maya' },
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
const FEATURE_MENU: { label: string; desc: string; href: string }[] = [
  {
    label: 'Shared Team Inbox',
    desc: 'One number, the whole team',
    href: '/features/shared-inbox',
  },
  {
    label: 'Broadcast Campaigns',
    desc: 'Reach thousands, one at a time',
    href: '/features/campaigns',
  },
  {
    label: 'Automations & Flows',
    desc: 'Replies that run themselves',
    href: '/ask-maya',
  },
  {
    label: 'Segments & Lists',
    desc: 'Target the right few hundred',
    href: '/features/segments',
  },
  {
    label: 'Sales Pipelines',
    desc: 'The chat is the deal',
    href: '/features/pipelines',
  },
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
/**
 * The Ask Maya link, which is not a plain nav word.
 *
 * The row above deliberately gave up per-link hover colours — five of
 * them competing was more personality than a nav bar should have. This
 * is not that: it is ONE item marked out, which is the thing five could
 * not do. Maya is the newest surface on the site and the one nobody
 * arrives already looking for, so the nav is where she gets introduced.
 *
 * Deliberately quieter than the signup button beside it — a soft tint
 * and a hairline, against that one's solid fill. Two emphatic elements
 * in the same bar would leave neither of them emphatic, and the CTA
 * still has to win.
 *
 * Her lockup rather than the words "Ask Maya": it is the one item in
 * the row that has a mark of its own, and the mark is what makes the
 * eye stop. The whole name is the artwork now — the `ask` cut, not the
 * bare one under a typed "Ask" — so the alt text is the accessible
 * name and nothing repeats it in the DOM.
 */
function MayaNavLink({ href, active }: { href: string; active?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // Height is pinned rather than left to the padding. The typed
        // "Ask" used to set it — a 24px line box that happened to land
        // the pill at 40px — and with the word gone the lockup alone
        // would have collapsed it to 29px, short beside the h-10 CTA.
        'group/maya inline-flex h-10 items-center rounded-full border-2 px-3.5 outline-none',
        'transition-colors duration-150 hover:border-(--lp2-maya)/70 hover:bg-(--lp2-maya-soft) focus-visible:border-(--lp2-maya)/70 focus-visible:bg-(--lp2-maya-soft)',
        // The active page wears the lit state permanently.
        active
          ? 'border-(--lp2-maya)/70 bg-(--lp2-maya-soft)'
          : 'border-(--lp2-maya)/35 bg-(--lp2-maya-soft)/60',
      )}
    >
      {/* The whole name in one mark, so "ask" is drawn rather than set
          in the UI face beside a lockup that owns only half the name.
          No separate Sparkle glyph either: the `ask` cut ends in the
          same chartreuse cluster, and a second one hung off its right
          edge read as a duplicate of the artwork's own.

          26px, which is the compromise this cut forces. The two files
          share a glyph scale — `maya` is 1351x493 and sits inside
          `ask maya`'s 1697x493 unchanged — so matching the old 13px
          would have kept "maya" identical and rendered "ask" at 3.5px,
          since "ask" is only 27% of the box height (rows 253-385 of
          493). Legibility there costs size here: "maya" comes out
          twice its old height, and "ask" still only reaches ~7px.

          Scale on hover instead of the sparkle's. A transform does not
          reflow, so the row stays put while the pill's own width is
          fixed by the padding. */}
      <MayaLockup
        variant="ask"
        className="h-[26px] transition-transform duration-200 group-hover/maya:scale-105"
      />
    </Link>
  );
}

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
          {/* Five columns for five items — one row, no orphan. This was
              `grid-cols-4` when the menu held eight and filled two rows
              exactly; five items in it would leave one stranded on a
              second row with three empty cells beside it. */}
          <div className="grid grid-cols-5 gap-1">
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
  active,
}: {
  items: { label: string; desc: string; href: string }[];
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
              ) : item.href === '/ask-maya' ? (
                <MayaNavLink
                  key={item.label}
                  href={item.href}
                  active={isActive(item.href)}
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
                      // Maya gets the tint here too, so the row that is
                      // marked out on desktop is not an ordinary row on
                      // a phone. The sheet's bullets carry the hues, so
                      // she keeps hers and gains a wash behind it —
                      // enough to separate her from four plain rows
                      // without turning the sheet into a colour chart.
                      item.href === '/ask-maya' &&
                        'bg-(--lp2-maya-soft)/50 hover:bg-(--lp2-maya-soft)',
                      // Active page: a permanent wash so the current row
                      // stands out in the list.
                      active &&
                        (item.href === '/ask-maya'
                          ? 'bg-(--lp2-maya-soft)'
                          : 'bg-(--lp2-ink)/8'),
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-3.5 rounded-full border-2 border-(--lp2-ink)"
                      style={{ backgroundColor: `var(--lp2-${item.hue})` }}
                    />
                    {item.label}
                    {item.href === '/ask-maya' && (
                      <Sparkle color="lime" className="size-3.5" />
                    )}
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
