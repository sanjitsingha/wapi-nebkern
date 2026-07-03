'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import {
  DEFAULT_SECTION,
  RAIL_GROUPS,
  SECTION_META,
  SETTINGS_SECTIONS,
  isSection,
  sectionHref,
  type SettingsSection,
} from './settings-sections';

const RAIL_DESKTOP_MIN_PX = 1024;

function getActiveSection(pathname: string): SettingsSection {
  const segment = pathname.replace(/^\/settings\/?/, '');
  return isSection(segment) ? segment : DEFAULT_SECTION;
}

export function SettingsRail() {
  const pathname = usePathname();
  const active = getActiveSection(pathname);
  const activeRef = useRef<HTMLAnchorElement>(null);

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
              return (
                <Link
                  key={s}
                  ref={isActive ? activeRef : undefined}
                  href={sectionHref(s)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium whitespace-nowrap transition-colors',
                    'lg:w-full',
                    isActive
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  <span className="flex-1">{meta.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
