'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useEntitlements } from '@/hooks/use-entitlements';
import {
  DEFAULT_SECTION,
  RAIL_GROUPS,
  SECTION_META,
  SETTINGS_SECTIONS,
  isSection,
  sectionHref,
  type SettingsSection,
} from './settings-sections';

/** Sections that exist only on plans with the matching feature flag. */
const SECTION_FEATURE = {
  calling: 'allowCalling',
  instagram: 'allowInstagram',
  'api-access': 'allowIntegrations',
  integrations: 'allowIntegrations',
} as const;

const RAIL_DESKTOP_MIN_PX = 1024;

function getActiveSection(pathname: string): SettingsSection {
  const segment = pathname.replace(/^\/settings\/?/, '');
  return isSection(segment) ? segment : DEFAULT_SECTION;
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
      {RAIL_GROUPS.map(({ label, group }) => {
        const items = SETTINGS_SECTIONS.filter(
          (s) => SECTION_META[s].group === group,
        );
        return (
          <div key={group} className="flex shrink-0 gap-1 lg:flex-col lg:gap-2">
            {label ? (
              <div className="hidden px-3 pt-4 pb-2 text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase lg:block">
                {label}
              </div>
            ) : null}
            {items.map((s) => {
              const meta = SECTION_META[s];
              const Icon = meta.icon;
              const isActive = s === active;
              const locked = isLocked(s);
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
                  className={cn(
                    'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium whitespace-nowrap transition-colors',
                    'lg:w-full',
                    isActive
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    locked && 'opacity-55 hover:opacity-80',
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  <span className="flex-1">{meta.label}</span>
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
