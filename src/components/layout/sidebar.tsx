'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { softBadge } from '@/lib/badge-colors';
import { useTotalUnread } from '@/hooks/use-total-unread';
import { useEntitlements } from '@/hooks/use-entitlements';
import {
  resolveSection,
  type SettingsSection,
} from '@/components/settings/settings-sections';
// Phosphor, not Lucide, for the whole nav — it ships `weight` as a real
// axis, so the active row's solid icon is the SAME glyph at
// `weight="fill"` rather than a second import that may or may not exist.
// Every icon here is therefore guaranteed to have a solid twin.
import {
  CaretDown,
  ChatCircleDots,
  ClipboardText,
  FileText,
  // Flows gets its own glyph rather than borrowing a neighbour's — in
  // the collapsed rail the icon is the only thing left, so two
  // destinations cannot wear the same one.
  FlowArrow,
  FunnelSimple,
  GitBranch,
  House,
  Image as ImageIcon,
  Lightning,
  ListBullets,
  Lock,
  Megaphone,
  PhoneCall,
  SidebarSimple,
  UsersThree,
  X,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';

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
  icon: PhosphorIcon;
  href: string;
  tab?: SettingsSection;
  unread?: boolean;
  /** Plan-gated: shown faded with an "Upgrade" badge; the target route
   *  renders the upgrade screen (server-side gate). */
  locked?: boolean;
}

// An expandable section with a chevron toggle.
interface NavGroup {
  label: string;
  icon: PhosphorIcon;
  children: NavLink[];
}

// Standalone items above the grouped nav (the reference's "Home").
const homeLink: NavLink = {
  label: 'Home',
  icon: House,
  href: '/dashboard',
};

// Maya has no row here any more. She moved into Settings → Workspace
// (/settings/maya), which is also where her rail entry lives — see
// settings-sections.ts. /askmaya and /agents both still resolve, so
// nothing that linked to the old surface is broken.

const quickLinks: NavLink[] = [
  {
    label: 'Inbox',
    icon: ChatCircleDots,
    href: '/inbox',
    unread: true,
  },
  // Next to Inbox, not buried in a group: a missed call is the same kind
  // of "someone is waiting on you" as an unread message.
  {
    label: 'Calls',
    icon: PhoneCall,
    href: '/calls',
  },
  {
    label: 'Campaigns',
    icon: Megaphone,
    href: '/campaigns',
  },
  // Promoted out of the grouped nav below. It was already a plain link
  // rather than a group, so it gained nothing from sitting there, and a
  // pipeline is checked as often as the inbox — it belongs with the
  // things you open every day, not behind a scroll.
  {
    label: 'Pipelines',
    icon: GitBranch,
    href: '/pipelines',
  },
];

// The main nav below Quick links. Mostly expandable groups, but an
// entry may be a plain NavLink where a group would have exactly one
// child — a chevron that reveals a single row is a click that buys
// nothing and buries the destination's name under a category.
const groups: (NavGroup | NavLink)[] = [
  {
    label: 'Contacts',
    icon: UsersThree,
    children: [
      { label: 'All Contacts', icon: UsersThree, href: '/contacts' },
      { label: 'Lists', icon: ListBullets, href: '/lists' },
      { label: 'Segments', icon: FunnelSimple, href: '/segments' },
    ],
  },
  {
    label: 'Market',
    icon: Megaphone,
    // Campaigns is not listed here. It sits in Quick links, and a nav
    // that offers the same destination twice makes the reader stop and
    // work out whether the two go to the same place.
    children: [
      { label: 'Templates', icon: FileText, href: '/templates' },
      { label: 'Forms', icon: ClipboardText, href: '/forms' },
      { label: 'Media', icon: ImageIcon, href: '/media' },
      // The QR generator moved out to the public site at /qr-generator.
      // It needs no account to be useful, so it works better as a free
      // tool anyone can land on than as a page behind the login.
    ],
  },
  {
    label: 'Automation',
    icon: Lightning,
    children: [
      { label: 'Automations', icon: Lightning, href: '/automations' },
      { label: 'Flows', icon: FlowArrow, href: '/flows' },
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
  const activeTab = resolveSection(searchParams.get('tab'));

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

  // One gate table for both nav shapes — a href that needs a plan is a
  // property of the destination, not of where it happens to be listed.
  const lockedFor = useCallback(
    (href: string): boolean => {
      const ent = entSnapshot?.entitlements;
      if (!ent) return false;
      if (href === '/automations') return !ent.allowAutomations;
      if (href === '/flows') return !ent.allowFlows;
      if (href === '/calls') return !ent.allowCalling;
      return false;
    },
    [entSnapshot]
  );

  const visibleGroups = useMemo(
    () =>
      groups.map((g) =>
        'children' in g
          ? {
              ...g,
              children: g.children.map((c) => ({
                ...c,
                locked: lockedFor(c.href),
              })),
            }
          : { ...g, locked: lockedFor(g.href) }
      ),
    [lockedFor]
  );

  const visibleQuickLinks = useMemo(
    () => quickLinks.map((l) => ({ ...l, locked: lockedFor(l.href) })),
    [lockedFor]
  );

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
    // Only groups can be opened; a flat entry has nothing to expand.
    const active = visibleGroups.find(
      (g) => 'children' in g && g.children.some(isLinkActive)
    );
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
        {/* The active row's icon goes solid. Same glyph, heavier weight —
            which is why this nav is on Phosphor: `fill` is an axis of the
            icon, so every destination gets a solid twin for free. */}
        <link.icon
          weight={active ? 'fill' : 'regular'}
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
          {/* A collapsed group whose child is the current page still
              signals it — so the group header fills too when any child
              is active, not only when the group is open. */}
          <group.icon
            weight={anyActive ? 'fill' : 'regular'}
            className="h-5.5 w-5.5 shrink-0"
          />
          <span
            className={cn(
              'flex-1 truncate text-left transition-opacity duration-200',
              isCollapsed && 'lg:opacity-0'
            )}
          >
            {group.label}
          </span>
          <CaretDown
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
          // Mobile: fixed drawer that slides in from the left, sitting
          // below the header. `top-16` tracks the header's `h-16` — the
          // drawer is fixed, so it can't inherit that and the two have
          // to be changed together.
          'border-border bg-card fixed top-16 bottom-0 left-0 z-40 flex w-64 flex-col overflow-hidden border-r',
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
                  <SidebarSimple className="h-5 w-5" />
                ) : (
                  <SidebarSimple className="h-5 w-5" />
                )}
              </button>
            </div>
          )}
          <ul className="flex flex-col gap-1.5">
            <li>{renderLink(homeLink)}</li>
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
            {visibleQuickLinks.map((link) => (
              <li key={link.href}>{renderLink(link)}</li>
            ))}
          </ul>

          <div className="border-border my-4 border-t" />

          <ul className="flex flex-col gap-1.5">
            {visibleGroups.map((g) =>
              'children' in g ? (
                renderGroup(g)
              ) : (
                <li key={g.href}>{renderLink(g)}</li>
              )
            )}
          </ul>
        </nav>

      </aside>
    </>
  );
}
