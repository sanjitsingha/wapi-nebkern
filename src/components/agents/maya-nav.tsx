'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Bot,
  LayoutDashboard,
  MessagesSquare,
  Palette,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

/** Maya's pages, top to bottom. Overview is the section root. */
const MAYA_SECTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/askmaya', label: 'Overview', icon: LayoutDashboard },
  { href: '/askmaya/personalization', label: 'Personalization', icon: Palette },
  { href: '/askmaya/knowledge-base', label: 'Knowledge base', icon: BookOpen },
  { href: '/askmaya/configuration', label: 'Activation', icon: Settings2 },
  { href: '/askmaya/playground', label: 'Playground', icon: MessagesSquare },
];

/**
 * Maya's side panel, drawn like the Settings rail (settings-rail.tsx) so
 * the two modules read alike: on lg+ a small heading carries the glyph
 * and the rows under it are plain, indented text; on phones the heading
 * is hidden and each chip in the scrolling strip keeps its own glyph.
 */
export function MayaNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Maya"
      className={cn(
        'flex gap-1 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'lg:flex-col lg:overflow-visible lg:pb-0',
      )}
    >
      <div className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
        {/* Glyph 14px + gap 10px keeps the label on the rows' `lg:ml-6`
            (24px) edge, as in the Settings rail. */}
        <div className="hidden items-center gap-2.5 px-3 pt-4 pb-1 text-xs font-medium text-muted-foreground lg:flex">
          <Bot className="size-3.5 shrink-0" />
          AI Agent
        </div>

        {MAYA_SECTIONS.map(({ href, label, icon: Icon }) => {
          // Overview is the root every other page sits under, so it only
          // lights up for itself.
          const active =
            href === '/askmaya'
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors',
                'lg:ml-6 lg:py-1.5 lg:text-[15px]',
                active
                  ? 'bg-muted text-primary'
                  : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground',
              )}
            >
              {/* Phone only: the chip strip has no heading. */}
              <Icon className="size-5 shrink-0 lg:hidden" />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
