'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { softBadge } from '@/lib/badge-colors';
import { useTotalUnread } from '@/hooks/use-total-unread';
import {
  resolveSection,
  type SettingsSection,
} from '@/components/settings/settings-sections';
import {
  Bot,
  ChevronDown,
  Coins,
  FileText,
  GitBranch,
  Home,
  Image as ImageIcon,
  Megaphone,
  MessageSquare,
  Users,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

// Fixed width of the sidebar's inner content. The <aside> animates its
// width between this (expanded) and a narrow rail (collapsed) while the
// content stays pinned at this width and is simply CLIPPED by the
// aside's overflow-hidden — so nothing reflows, shifts, or resizes; the
// labels just slide out of view as the rail narrows.
const CONTENT_W = 'w-64'; // 16rem / 256px

// A single clickable destination. `tab` marks a Settings sub-section
// (active state keys off `?tab=` rather than the path, since they all
// live under /settings). `unread` flags the Inbox row for the dot.
interface NavLink {
  label: string;
  icon: LucideIcon;
  href: string;
  tab?: SettingsSection;
  badge?: 'New' | 'Beta';
  unread?: boolean;
}

// An expandable section with a chevron toggle.
interface NavGroup {
  label: string;
  icon: LucideIcon;
  badge?: 'New';
  children: NavLink[];
}

// Standalone items above the grouped nav (the reference's "Home").
const homeLink: NavLink = {
  label: 'Home',
  icon: Home,
  href: '/dashboard',
};

// AI Agents sits on its own, outside any group — a first-class surface.
const agentsLink: NavLink = {
  label: 'AI Agents',
  icon: Bot,
  href: '/agents',
  badge: 'New',
};

const quickLinks: NavLink[] = [
  { label: 'Inbox', icon: MessageSquare, href: '/inbox', unread: true },
  { label: 'Contacts', icon: Users, href: '/contacts' },
  { label: 'Campaigns', icon: Megaphone, href: '/campaigns' },
];

// Expandable groups. Settings fans out into the real `?tab=` sections
// (settings-sections.ts), so every child is a live page — no stubs.
const groups: NavGroup[] = [
  {
    label: 'Market',
    icon: Megaphone,
    children: [
      { label: 'Campaigns', icon: Megaphone, href: '/campaigns' },
      { label: 'Templates', icon: FileText, href: '/templates' },
      { label: 'Media', icon: ImageIcon, href: '/media' },
    ],
  },
  {
    label: 'Sales CRM',
    icon: GitBranch,
    children: [
      { label: 'Pipelines', icon: GitBranch, href: '/pipelines' },
      {
        label: 'Deals',
        icon: Coins,
        href: '/settings/deals',
        tab: 'deals',
      },
    ],
  },
  {
    label: 'Automation',
    icon: Zap,
    badge: 'New',
    children: [
      { label: 'Automations', icon: Zap, href: '/automations' },
      { label: 'Flows', icon: Workflow, href: '/flows', badge: 'Beta' },
    ],
  },
];

interface SidebarProps {
  /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
  open?: boolean;
  onClose?: () => void;
  /**
   * Desktop-only icon-rail collapse. When true, the sidebar narrows to
   * a rail; the content is clipped, not re-laid-out. No effect on
   * mobile (< lg), where the drawer is always full width.
   */
  collapsed?: boolean;
}

export function Sidebar({
  open = false,
  onClose,
  collapsed = false,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalUnread = useTotalUnread();
  const activeTab = resolveSection(searchParams.get('tab'));
  const [hovered, setHovered] = useState(false);

  // Which expandable groups are open. The group containing the active
  // route is auto-opened; collapsing the sidebar does NOT change this —
  // open groups stay open (and clipped), per the "keep it intact" rule.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isCollapsed = collapsed && !hovered;

  const isLinkActive = (link: NavLink): boolean => {
    if (link.tab) {
      return (
        (pathname === '/settings' && activeTab === link.tab) ||
        pathname === `/settings/${link.tab}` ||
        pathname.startsWith(`/settings/${link.tab}/`)
      );
    }
    if (link.href === '/dashboard') return pathname === '/dashboard';
    return pathname === link.href || pathname.startsWith(link.href + '/');
  };

  useEffect(() => {
    // Collapsing the sidebar to the icon rail also closes any expanded
    // group — a half-open menu makes no sense on the rail. Expanding
    // again re-opens the group that holds the current route.
    if (isCollapsed) {
      setOpenGroups({});
      return;
    }
    const active = groups.find((g) => g.children.some(isLinkActive));
    if (active) {
      setOpenGroups((prev) =>
        prev[active.label] ? prev : { ...prev, [active.label]: true }
      );
    }
    // isLinkActive closes over pathname + activeTab, the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, activeTab, isCollapsed]);

  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // ---- row renderers -------------------------------------------------
  // Note: nothing here branches on `collapsed`. The full row always
  // renders identically; the aside's width + overflow-hidden clips it.

  const renderLink = (link: NavLink, indented = false) => {
    const active = isLinkActive(link);
    return (
      <Link
        href={link.href}
        onClick={onClose}
        title={link.label}
        className={cn(
          'relative flex items-center gap-3.5 rounded-lg px-3 text-sm font-medium transition-colors',
          indented ? 'py-3' : 'py-3.5',
          active
            ? 'bg-primary-soft text-primary font-semibold'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <link.icon
          className={cn('shrink-0', indented ? 'h-5 w-5' : 'h-5.5 w-5.5')}
        />
        <span
          className={cn(
            'flex-1 truncate transition-opacity duration-200',
            isCollapsed && 'lg:opacity-0'
          )}
        >
          {link.label}
        </span>
        {link.badge === 'Beta' && (
          <span
            className={cn(
              'shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase transition-opacity duration-200',
              softBadge.amber,
              isCollapsed && 'lg:opacity-0'
            )}
          >
            Beta
          </span>
        )}
        {link.badge === 'New' && (
          <span
            className={cn(
              'shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase transition-opacity duration-200',
              isCollapsed && 'lg:opacity-0'
            )}
          >
            New
          </span>
        )}
        {link.unread && totalUnread > 0 && (
          <span
            aria-label={`${totalUnread} unread conversation${totalUnread === 1 ? '' : 's'}`}
            className={cn(
              'flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums transition-opacity duration-200',
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-primary-soft text-primary',
              isCollapsed && 'lg:opacity-0'
            )}
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </Link>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const open = !!openGroups[group.label];
    const anyActive = group.children.some(isLinkActive);
    return (
      <li key={group.label}>
        <button
          type="button"
          onClick={() =>
            setOpenGroups((p) => ({ ...p, [group.label]: !p[group.label] }))
          }
          aria-expanded={open}
          title={group.label}
          className={cn(
            'flex w-full items-center gap-3.5 rounded-lg px-3 py-3.5 text-sm font-medium transition-colors',
            anyActive
              ? 'text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <group.icon className="h-5.5 w-5.5 shrink-0" />
          <span
            className={cn(
              'flex-1 truncate text-left transition-opacity duration-200',
              isCollapsed && 'lg:opacity-0'
            )}
          >
            {group.label}
          </span>
          {group.badge === 'New' && (
            <span
              className={cn(
                'shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase transition-opacity duration-200',
                isCollapsed && 'lg:opacity-0'
              )}
            >
              New
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-4.5 w-4.5 shrink-0 transition-all duration-200',
              open && 'rotate-180',
              isCollapsed && 'lg:opacity-0'
            )}
          />
        </button>

        {/* Children stay rendered when open — collapsing just clips them. */}
        {open && (
          <ul className="border-border mt-1.5 mb-1.5 ml-[1.5rem] flex flex-col gap-1.5 border-l pl-3">
            {group.children.map((child) => (
              <li key={child.href}>{renderLink(child, true)}</li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      {/* Backdrop — mobile only, only when open. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          'bg-black/50 fixed inset-0 z-30 transition-opacity lg:hidden',
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        )}
      />

      <aside
        className={cn(
          // Mobile: fixed drawer that slides in from the left, sitting below the header.
          'border-border bg-card fixed top-14 bottom-0 left-0 z-40 flex w-64 flex-col overflow-hidden border-r',
          'transition-transform duration-200 ease-out will-change-transform',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop: static. Width animates between full and the rail; the
          // inner content (fixed width) is clipped — no reflow.
          'lg:static lg:top-auto lg:bottom-auto lg:z-0 lg:translate-x-0 lg:transition-[width] lg:duration-200 lg:ease-out',
          isCollapsed ? 'lg:w-16' : 'lg:w-64'
        )}
        aria-label="Primary"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Main navigation — starts directly with items, no logo row. */}
        <nav
          className={cn(
            'flex-1 overflow-x-hidden overflow-y-auto px-3 py-4',
            CONTENT_W
          )}
        >
          {/* Mobile close button */}
          <div className="mb-2 flex justify-end lg:hidden">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <ul className="flex flex-col gap-1.5">
            <li>{renderLink(homeLink)}</li>
            <li>{renderLink(agentsLink)}</li>
          </ul>

          {/* Expanded: single-line label. Collapsed (lg rail): instead of
              fading out, it re-wraps to a centered two-line "Quick /
              Links" stack that fits the narrow icon rail. */}
          <p
            className={cn(
              'text-muted-foreground/70 px-3 pt-6 pb-2 text-[10px] font-semibold tracking-wider whitespace-nowrap uppercase',
              isCollapsed && 'lg:hidden'
            )}
          >
            Quick links
          </p>
          {isCollapsed && (
            // `nav` keeps a fixed w-64 (CONTENT_W) at all times — only the
            // <aside> narrows on collapse, clipping the overflow — so a
            // plain `text-center` here would center within the full
            // 256px nav, off in the clipped-away region. `-ml-3 w-16`
            // cancels nav's own left padding and pins this box to
            // exactly the 64px window that's actually visible, so the
            // text centers within the real collapsed rail.
            <p className="text-muted-foreground/70 hidden pt-6 pb-2 text-center text-[9px] leading-tight font-semibold tracking-wider uppercase lg:-ml-3 lg:block lg:w-16">
              Quick
              <br />
              Links
            </p>
          )}
          <ul className="flex flex-col gap-1.5">
            {quickLinks.map((link) => (
              <li key={link.href}>{renderLink(link)}</li>
            ))}
          </ul>

          <div className="border-border my-4 border-t" />

          <ul className="flex flex-col gap-1.5">{groups.map(renderGroup)}</ul>
        </nav>
      </aside>
    </>
  );
}
