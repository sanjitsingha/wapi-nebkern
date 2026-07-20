'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { softBadge } from '@/lib/badge-colors';
import { useTotalUnread } from '@/hooks/use-total-unread';
import { useSupportUnread } from '@/hooks/use-support-unread';
import { useEntitlements } from '@/hooks/use-entitlements';
import { SupportDialog } from '@/components/support/support-dialog';
import { useWalkthrough } from '@/components/walkthrough/walkthrough-provider';
import {
  resolveSection,
  type SettingsSection,
} from '@/components/settings/settings-sections';
import {
  Bot,
  ChevronDown,
  Coins,
  Compass,
  FileText,
  Filter,
  GitBranch,
  Headset,
  Home,
  Image as ImageIcon,
  List,
  Lock,
  Megaphone,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
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
  /** Plan-gated: shown faded with an "Upgrade" badge; the target route
   *  renders the upgrade screen (server-side gate). */
  locked?: boolean;
  /** Anchor id for the guided walkthrough (lib/walkthrough/steps.ts).
   *  Emitted as `data-walkthrough` — the tour's contract with the DOM,
   *  so restyling this row can't break the spotlight. */
  walkthrough?: string;
}

// An expandable section with a chevron toggle.
interface NavGroup {
  label: string;
  icon: LucideIcon;
  badge?: 'New';
  children: NavLink[];
  /** See NavLink.walkthrough. Anchored on the group toggle, which is
   *  always mounted — the children only exist while expanded. */
  walkthrough?: string;
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
  walkthrough: 'agents',
};

const quickLinks: NavLink[] = [
  {
    label: 'Inbox',
    icon: MessageSquare,
    href: '/inbox',
    unread: true,
    walkthrough: 'inbox',
  },
  {
    label: 'Campaigns',
    icon: Megaphone,
    href: '/campaigns',
    walkthrough: 'campaigns',
  },
];

// Expandable groups. Settings fans out into the real `?tab=` sections
// (settings-sections.ts), so every child is a live page — no stubs.
const groups: NavGroup[] = [
  {
    label: 'Contacts',
    icon: Users,
    walkthrough: 'contacts',
    children: [
      { label: 'All Contacts', icon: Users, href: '/contacts' },
      { label: 'Lists', icon: List, href: '/lists' },
      { label: 'Segments', icon: Filter, href: '/segments' },
    ],
  },
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
        // Deals & currency now lives as a tab inside Settings → Customization.
        label: 'Deals',
        icon: Coins,
        href: '/settings/customization?tab=deals',
        tab: 'customization',
      },
    ],
  },
  {
    label: 'Automation',
    icon: Zap,
    badge: 'New',
    walkthrough: 'automation',
    children: [
      { label: 'Automations', icon: Zap, href: '/automations' },
      { label: 'Flows', icon: Bot, href: '/flows', badge: 'Beta' },
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
   *
   * Purely click-driven: the rail used to also expand on hover, which
   * made the sidebar move whenever the pointer crossed it on the way
   * to something else. Collapsed now stays collapsed until the toggle
   * is pressed.
   */
  collapsed?: boolean;
  /** Flip the desktop collapse. Persisted by the shell. */
  onToggleCollapse?: () => void;
}

export function Sidebar({
  open = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalUnread = useTotalUnread();
  const supportUnread = useSupportUnread();
  const activeTab = resolveSection(searchParams.get('tab'));
  const [supportOpen, setSupportOpen] = useState(false);
  const { start: startWalkthrough } = useWalkthrough();

  // Which expandable groups are open. The group containing the active
  // route is auto-opened; collapsing the sidebar does NOT change this —
  // open groups stay open (and clipped), per the "keep it intact" rule.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Plan gating — nav entries for features the plan excludes stay
  // visible but fade out and wear an "Upgrade" badge (fail open while
  // entitlements load, so allowed users never see a flicker). The link
  // still navigates: the target route's server-side gate renders the
  // upgrade screen.
  const { snapshot: entSnapshot } = useEntitlements();
  const visibleGroups = useMemo(() => {
    const ent = entSnapshot?.entitlements;
    if (!ent) return groups;
    const lockedFor = (href: string): boolean => {
      if (href === '/automations') return !ent.allowAutomations;
      if (href === '/flows') return !ent.allowFlows;
      return false;
    };
    return groups.map((g) => ({
      ...g,
      children: g.children.map((c) => ({ ...c, locked: lockedFor(c.href) })),
    }));
  }, [entSnapshot]);

  // Straight through from the prop — no hover override. On mobile the
  // drawer is always full width, which the `lg:` prefixes below handle.
  const isCollapsed = collapsed;

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
    const active = visibleGroups.find((g) => g.children.some(isLinkActive));
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
        data-walkthrough={link.walkthrough}
        title={
          link.locked
            ? `${link.label} — upgrade your plan to unlock`
            : link.label
        }
        className={cn(
          'relative flex items-center gap-3.5 rounded-lg px-3 text-sm font-medium transition-colors',
          indented ? 'py-3' : 'py-3.5',
          active
            ? 'bg-primary-soft text-primary font-semibold'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          link.locked && 'opacity-55 hover:opacity-80'
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
        {link.locked && (
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase transition-opacity duration-200',
              softBadge.amber,
              isCollapsed && 'lg:opacity-0'
            )}
          >
            <Lock className="h-2.5 w-2.5" />
            Upgrade
          </span>
        )}
        {!link.locked && link.badge === 'Beta' && (
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
        {!link.locked && link.badge === 'New' && (
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
          data-walkthrough={group.walkthrough}
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
          'fixed inset-0 z-30 bg-black/50 transition-opacity lg:hidden',
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

          {/* Desktop collapse toggle. Left-aligned on purpose: `nav`
              keeps its full 256px width and the <aside> clips it, so
              anything right-aligned would be clipped away in the 64px
              rail — exactly when you need this button to un-collapse. */}
          {onToggleCollapse && (
            <div className="mb-2 hidden lg:flex">
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!isCollapsed}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors"
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </button>
            </div>
          )}
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

          <ul className="flex flex-col gap-1.5">{visibleGroups.map(renderGroup)}</ul>
        </nav>

        {/* Footer — pinned below the scrolling nav. Walkthrough replays
            the guided tour; Support opens the ticketing modal, whose
            icon carries an alert dot (kept visible even on the
            collapsed rail) when the team has replied. */}
        <div className={cn('border-border border-t p-3', CONTENT_W)}>
          <button
            type="button"
            onClick={() => {
              onClose?.();
              startWalkthrough();
            }}
            data-walkthrough="walkthrough"
            title="Walkthrough"
            className="relative flex w-full items-center gap-3.5 rounded-lg px-3 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Compass className="h-5.5 w-5.5 shrink-0" />
            <span
              className={cn(
                'flex-1 truncate text-left transition-opacity duration-200',
                isCollapsed && 'lg:opacity-0'
              )}
            >
              Walkthrough
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSupportOpen(true)}
            data-walkthrough="support"
            title="Support"
            className="relative flex w-full items-center gap-3.5 rounded-lg px-3 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <span className="relative shrink-0">
              <Headset className="h-5.5 w-5.5" />
              {supportUnread > 0 && (
                <span
                  aria-hidden
                  className="bg-primary ring-card absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2"
                />
              )}
            </span>
            <span
              className={cn(
                'flex-1 truncate text-left transition-opacity duration-200',
                isCollapsed && 'lg:opacity-0'
              )}
            >
              Support
            </span>
            {supportUnread > 0 && (
              <span
                aria-label={`${supportUnread} unread support ${supportUnread === 1 ? 'reply' : 'replies'}`}
                className={cn(
                  'bg-primary-soft text-primary flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums transition-opacity duration-200',
                  isCollapsed && 'lg:opacity-0'
                )}
              >
                {supportUnread > 99 ? '99+' : supportUnread}
              </span>
            )}
          </button>
        </div>
      </aside>

      <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
    </>
  );
}
