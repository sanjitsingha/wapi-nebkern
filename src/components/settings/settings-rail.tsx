'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { softBadge } from '@/lib/badge-colors';
import { useEntitlements } from '@/hooks/use-entitlements';
// Reached across from the marketing scope rather than copied: the
// component is a next/image wrapper over a file in public/ and uses
// none of lp2's tokens, so it renders correctly in the app shell.
import { MayaLockup } from '@/components/lp2/maya-lockup';
import {
  DEFAULT_SECTION,
  RAIL_GROUPS,
  RAIL_SECTIONS,
  SECTION_META,
  isSection,
  railSection,
  sectionHref,
  type SettingsSection,
} from './settings-sections';
import { INTEGRATION_RAIL_LINKS } from './integrations-catalog';

/**
 * Sections that exist only on plans with the matching feature flag.
 *
 * The combined "Instagram & Messenger" section is deliberately absent
 * even though Instagram is plan-gated: it also carries Messenger, which
 * every plan gets, so locking it would hide a channel the account owns.
 * Its Instagram half is gated server-side at connect time, and the
 * Instagram sub-page carries its own FeatureGate.
 */
const SECTION_FEATURE = {
  calling: 'allowCalling',
  'api-access': 'allowIntegrations',
  integrations: 'allowIntegrations',
} as const;

const RAIL_DESKTOP_MIN_PX = 1024;

// Which rail entry is current. Sub-pages (Instagram, Messenger) have no
// row of their own, so they resolve to the parent row that owns them.
// Only the first segment names the section: /settings/integrations/zapier
// is still the integrations section.
function getActiveSection(pathname: string): SettingsSection {
  const segment = pathname.replace(/^\/settings\/?/, '').split('/')[0];
  return railSection(isSection(segment) ? segment : DEFAULT_SECTION);
}

export function SettingsRail() {
  const pathname = usePathname();
  const active = getActiveSection(pathname);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Plan-gated sections stay visible but fade + wear a lock; the page
  // behind them shows the upgrade card. Fail open while loading.
  const { snapshot: entSnapshot } = useEntitlements();
  const isLocked = (s: SettingsSection): boolean => {
    const ent = entSnapshot?.entitlements;
    if (!ent) return false;
    const feature = SECTION_FEATURE[s as keyof typeof SECTION_FEATURE];
    return feature ? !ent[feature] : false;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia(`(min-width: ${RAIL_DESKTOP_MIN_PX}px)`).matches) return;
    activeRef.current?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [active]);

  return (
    <nav
      aria-label="Settings sections"
      className={cn(
        'flex gap-1 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'lg:flex-col lg:overflow-visible lg:pb-0',
      )}
    >
      {RAIL_GROUPS.map(({ label, group, icon: GroupIcon }, groupIndex) => {
        const items = RAIL_SECTIONS.filter(
          (s) => SECTION_META[s].group === group,
        );
        return (
          <div
            key={group}
            className={cn(
              'flex shrink-0 gap-1 lg:flex-col lg:gap-0.5',
              // Mobile hides the group headings, so without this the four
              // groups run together as one long strip of chips. The rule
              // is the only thing marking where one ends. Desktop has the
              // headings and doesn't need it.
              groupIndex > 0 && 'ml-1 border-l border-border pl-2 lg:ml-0 lg:border-l-0 lg:pl-0',
            )}
          >
            {/* Desktop: the heading carries the group's glyph and the rows
                under it are plain, indented text — a settings index, not
                a second app sidebar. */}
            {label ? (
              <div className="hidden items-center gap-2 px-3 pt-4 pb-1 text-[15px] font-medium text-muted-foreground lg:flex">
                {GroupIcon && <GroupIcon className="size-4 shrink-0" />}
                {label}
              </div>
            ) : null}
            {items.map((s) => {
              const meta = SECTION_META[s];
              const Icon = meta.icon;
              const isActive = s === active;
              const soon = meta.comingSoon === true;
              // A shelved section is never also plan-locked — "coming
              // soon" wins, so we don't show two competing badges.
              const locked = !soon && isLocked(s);

              const body = (
                <>
                  {meta.mark === 'maya' ? (
                    /* The mark replaces both the glyph and the label —
                       it spells the name itself, so setting "Maya" in
                       type beside it would say it twice. Held to 18px
                       so the wordmark's letters land at about the
                       weight of the 15px labels it sits among; the
                       rail is a list of peers, not a place for a logo
                       to shout.

                       `flex-1` goes on the wrapper, never on the image:
                       the label it replaces is what pushes the lock and
                       the badge out to the right-hand edge, but a
                       flex-grown `<img>` would take its width from the
                       track instead of from `w-auto` and stretch the
                       wordmark. */
                    <span className="flex flex-1 items-center">
                      <MayaLockup variant="bare" className="h-[18px] shrink-0" />
                    </span>
                  ) : (
                    <>
                      {/* Phone only: the chip strip has no headings, so
                          each chip keeps its glyph. */}
                      {Icon && <Icon className="size-5 shrink-0 lg:hidden" />}
                      <span className="flex-1">{meta.label}</span>
                    </>
                  )}

                  {locked && <Lock className="size-3.5 shrink-0 opacity-70" />}
                  {soon && (
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase',
                        softBadge.neutral,
                      )}
                    >
                      Soon
                    </span>
                  )}
                </>
              );

              const shell = cn(
                'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors',
                'lg:py-1.5 lg:text-[15px]',
                // Indented under a heading so the text lines up with the
                // heading's label, past its glyph. Maya's row has no
                // heading and sits flush.
                label && 'lg:ml-6',
                meta.mobileOnly && 'lg:hidden',
                isActive
                  ? 'bg-muted text-primary'
                  : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground',
                locked && 'opacity-55 hover:opacity-80',
              );

              // Shelved sections render as inert text, not a link — the
              // page behind them has nothing to configure yet, so
              // navigating there is a dead end.
              if (soon) {
                return (
                  <span
                    key={s}
                    aria-disabled="true"
                    title={`${meta.label} — coming soon`}
                    className={cn(
                      shell,
                      'cursor-default opacity-55 hover:bg-transparent hover:text-muted-foreground',
                    )}
                  >
                    {body}
                  </span>
                );
              }

              return (
                <Link
                  key={s}
                  ref={isActive ? activeRef : undefined}
                  href={sectionHref(s)}
                  aria-current={isActive ? 'page' : undefined}
                  title={
                    locked
                      ? `${meta.label} — upgrade your plan to unlock`
                      : undefined
                  }
                  className={shell}
                >
                  {body}
                </Link>
              );
            })}

            {/* One row per integration, each opening its own page.
                Desktop only: on a phone the chip strip stays short, and
                its Integrations chip opens the grid of all of them. */}
            {group === 'integrations' &&
              INTEGRATION_RAIL_LINKS.map((link) => {
                const isActive = pathname === link.href;
                const locked = isLocked('integrations');
                return (
                  <Link
                    key={link.id}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    title={
                      locked
                        ? `${link.label} — upgrade your plan to unlock`
                        : undefined
                    }
                    className={cn(
                      'hidden shrink-0 items-center gap-3 rounded-lg px-3 py-1.5 text-left text-[15px] font-medium whitespace-nowrap transition-colors lg:ml-6 lg:flex',
                      isActive
                        ? 'bg-muted text-primary'
                        : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground',
                      locked && 'opacity-55 hover:opacity-80',
                    )}
                  >
                    <span className="flex-1">{link.label}</span>
                    {locked && <Lock className="size-3.5 shrink-0 opacity-70" />}
                  </Link>
                );
              })}
          </div>
        );
      })}
    </nav>
  );
}
