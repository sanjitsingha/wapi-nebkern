"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { softBadge } from "@/lib/badge-colors";
import { useTotalUnread } from "@/hooks/use-total-unread";
import {
  resolveSection,
  type SettingsSection,
} from "@/components/settings/settings-sections";
import {
  ChevronDown,
  Coins,
  FileText,
  GitBranch,
  LayoutDashboard,
  MessageSquare,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PlugZap,
  Radio,
  Settings,
  Tags,
  User,
  Users,
  UsersRound,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

// A single clickable destination. `tab` marks a Settings sub-section
// (active state keys off `?tab=` rather than the path, since they all
// live under /settings). `unread` flags the Inbox row for the dot.
interface NavLink {
  label: string;
  icon: LucideIcon;
  href: string;
  tab?: SettingsSection;
  badge?: "New" | "Beta";
  unread?: boolean;
}

// An expandable section. Renders a chevron toggle in the full sidebar
// and an icon-link (to the first child) on the collapsed rail.
interface NavGroup {
  label: string;
  icon: LucideIcon;
  badge?: "New";
  children: NavLink[];
}

// Standalone item above the grouped nav (the reference's "Home").
const homeLink: NavLink = {
  label: "Dashboard",
  icon: LayoutDashboard,
  href: "/dashboard",
};

const quickLinks: NavLink[] = [
  { label: "Inbox", icon: MessageSquare, href: "/inbox", unread: true },
  { label: "Contacts", icon: Users, href: "/contacts" },
  { label: "Broadcasts", icon: Radio, href: "/broadcasts" },
];

// Expandable groups. Settings fans out into the real `?tab=` sections
// (settings-sections.ts), so every child is a live page — no stubs.
const groups: NavGroup[] = [
  {
    label: "Sales CRM",
    icon: GitBranch,
    children: [
      { label: "Pipelines", icon: GitBranch, href: "/pipelines" },
      { label: "Deals", icon: Coins, href: "/settings?tab=deals", tab: "deals" },
    ],
  },
  {
    label: "Automation",
    icon: Zap,
    badge: "New",
    children: [
      { label: "Automations", icon: Zap, href: "/automations" },
      { label: "Flows", icon: Workflow, href: "/flows", badge: "Beta" },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    children: [
      { label: "WhatsApp", icon: PlugZap, href: "/settings?tab=whatsapp", tab: "whatsapp" },
      { label: "Templates", icon: FileText, href: "/settings?tab=templates", tab: "templates" },
      { label: "Team members", icon: UsersRound, href: "/settings?tab=members", tab: "members" },
      { label: "Fields & tags", icon: Tags, href: "/settings?tab=fields", tab: "fields" },
      { label: "Your profile", icon: User, href: "/settings?tab=profile", tab: "profile" },
      { label: "Appearance", icon: Palette, href: "/settings?tab=appearance", tab: "appearance" },
    ],
  },
];

interface SidebarProps {
  /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
  open?: boolean;
  onClose?: () => void;
  /**
   * Desktop-only icon-rail collapse. When true, the sidebar narrows to
   * a rail showing just icons; labels and text are hidden. Has no
   * effect on mobile (< lg), where the drawer is always full width.
   */
  collapsed?: boolean;
  /** Toggles the desktop collapse. Drives the in-sidebar toggle button. */
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
  const activeTab = resolveSection(searchParams.get("tab"));

  // Which expandable groups are open. The group containing the active
  // route is auto-opened (without collapsing ones the user opened).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isLinkActive = (link: NavLink): boolean => {
    if (link.tab) return pathname === "/settings" && activeTab === link.tab;
    if (link.href === "/dashboard") return pathname === "/dashboard";
    return pathname === link.href || pathname.startsWith(link.href + "/");
  };

  // Auto-open the active group on navigation.
  useEffect(() => {
    const active = groups.find((g) => g.children.some(isLinkActive));
    if (active) {
      setOpenGroups((prev) =>
        prev[active.label] ? prev : { ...prev, [active.label]: true },
      );
    }
    // isLinkActive closes over pathname + activeTab, which are the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, activeTab]);

  // Close the drawer when route changes — users opened it to navigate,
  // so once they pick a destination the drawer should get out of the way.
  useEffect(() => {
    onClose?.();
    // Only pathname drives this — onClose identity doesn't need to re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll and allow Escape to close while the drawer is open on
  // mobile. No-ops on desktop because the sidebar isn't positioned there.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // ---- row renderers -------------------------------------------------

  const renderLink = (link: NavLink, indented = false) => {
    const active = isLinkActive(link);
    return (
      <Link
        href={link.href}
        onClick={onClose}
        title={collapsed && !indented ? link.label : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-lg px-3 font-medium transition-colors",
          indented ? "py-2 text-sm lg:py-1.5" : "py-2.5 text-base lg:py-2",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <link.icon className={cn("shrink-0", indented ? "h-4 w-4" : "h-5 w-5")} />
        <span className={cn("flex-1", collapsed && "lg:hidden")}>
          {link.label}
        </span>
        {link.badge === "Beta" && (
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
              softBadge.amber,
              collapsed && !indented && "lg:hidden",
            )}
          >
            Beta
          </span>
        )}
        {link.badge === "New" && (
          <span
            className={cn(
              "rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white",
              collapsed && !indented && "lg:hidden",
            )}
          >
            New
          </span>
        )}
        {link.unread && totalUnread > 0 && !active && (
          <span
            aria-label={`${totalUnread} unread conversation${totalUnread === 1 ? "" : "s"}`}
            className="relative flex h-2 w-2"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
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
        {/* Group header. On the collapsed rail only the icon shows
            (label, badge, chevron hide) — placement is identical to the
            expanded state, the sidebar just narrows. */}
        <button
          type="button"
          onClick={() =>
            setOpenGroups((p) => ({ ...p, [group.label]: !p[group.label] }))
          }
          aria-expanded={open}
          title={collapsed ? group.label : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors lg:py-2",
            anyActive
              ? "text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <group.icon className="h-5 w-5 shrink-0" />
          <span className={cn("flex-1 text-left", collapsed && "lg:hidden")}>
            {group.label}
          </span>
          {group.badge === "New" && (
            <span
              className={cn(
                "rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white",
                collapsed && "lg:hidden",
              )}
            >
              New
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
              collapsed && "lg:hidden",
            )}
          />
        </button>

        {/* Children — nested, with a tree rail. Hidden on the collapsed
            desktop rail. */}
        {open && (
          <ul
            className={cn(
              "mt-1 ml-[1.35rem] flex flex-col gap-1 border-l border-border pl-2",
              collapsed && "lg:hidden",
            )}
          >
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
      {/* Backdrop — only exists on mobile and only when open. Clicking
          it closes the drawer. Hidden from lg+ since the sidebar is
          part of the main flex row there. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-background/70 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          // Mobile: fixed drawer that slides in from the left.
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-border bg-card",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: static, always visible — reset all the mobile framing.
          // Width animates between the full sidebar and the icon rail.
          "lg:static lg:z-0 lg:translate-x-0 lg:transition-[width] lg:duration-200 lg:ease-out",
          collapsed ? "lg:w-16" : "lg:w-60",
        )}
        aria-label="Primary"
      >
        {/* Logo row. On mobile we put a close button here; on desktop the
            close button is hidden since the sidebar is always-visible. */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2"
            title={collapsed ? "CRM Template for WhatsApp" : undefined}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageSquare className="h-4 w-4" />
            </div>
            <span
              className={cn(
                "text-sm font-semibold text-foreground",
                collapsed && "lg:hidden",
              )}
            >
              CRM Template for WhatsApp
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {/* Standalone top item */}
          <ul className="flex flex-col gap-1">
            <li>{renderLink(homeLink)}</li>
          </ul>

          {/* Quick links section */}
          <p
            className={cn(
              "px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
              collapsed && "lg:hidden",
            )}
          >
            Quick links
          </p>
          <ul className="flex flex-col gap-1">
            {quickLinks.map((link) => (
              <li key={link.href}>{renderLink(link)}</li>
            ))}
          </ul>

          <div className="my-3 border-t border-border" />

          {/* Expandable groups */}
          <ul className="flex flex-col gap-1">{groups.map(renderGroup)}</ul>

          {/* Desktop-only collapse toggle. Lives in the sidebar so it
              travels with the nav in both states. Hidden on mobile,
              where the drawer is driven by the header hamburger. */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="mt-2 hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" />
            ) : (
              <PanelLeftClose className="h-4 w-4 shrink-0" />
            )}
            <span className={cn("flex-1 text-left", collapsed && "lg:hidden")}>
              Collapse
            </span>
          </button>
        </nav>
      </aside>
    </>
  );
}
