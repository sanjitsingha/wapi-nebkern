'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserCog,
  CreditCard,
  KeyRound,
  Bell,
  Megaphone,
  MonitorPlay,
  Newspaper,
  Inbox,
  Mails,
  LifeBuoy,
  Activity,
  LogOut,
  Terminal,
  Menu,
  Search,
  X,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CommandPalette, type PaletteTarget } from './command-palette';

// ============================================================
// Chrome for the admin back office.
//
// Grouped nav rather than thirteen equal-weight links in one column,
// so you look in a section of three or four instead of scanning all of
// them. The groups are the jobs the panel actually does: running
// tenants, taking money, answering people, publishing things, keeping
// the lights on.
//
// The whole tree is wrapped in `.admin-ui`, which is what re-scales
// every radius in here (see admin.css) — including the shadcn controls
// the manager components render, none of which know they are in an
// admin panel.
//
// Deliberately independent of the tenant dashboard's Sidebar/Header so
// `src/app/admin` stays a liftable unit.
// ============================================================

const NAV: {
  group: string;
  items: { label: string; href: string; icon: typeof Users }[];
}[] = [
  {
    group: 'Tenants',
    items: [
      { label: 'Overview', href: '/admin', icon: LayoutDashboard },
      { label: 'Accounts', href: '/admin/accounts', icon: Users },
      { label: 'Users', href: '/admin/users', icon: UserCog },
    ],
  },
  {
    group: 'Revenue',
    items: [
      { label: 'Plans', href: '/admin/plans', icon: CreditCard },
      {
        label: 'Activation codes',
        href: '/admin/activation-codes',
        icon: KeyRound,
      },
    ],
  },
  {
    group: 'Inbox',
    items: [
      { label: 'Tickets', href: '/admin/tickets', icon: LifeBuoy },
      { label: 'Enquiries', href: '/admin/contact', icon: Inbox },
      { label: 'Newsletter', href: '/admin/newsletter', icon: Mails },
    ],
  },
  {
    group: 'Publishing',
    items: [
      { label: 'Blog', href: '/admin/blog', icon: Newspaper },
      { label: 'Notifications', href: '/admin/notifications', icon: Bell },
      { label: 'Announcements', href: '/admin/announcements', icon: Megaphone },
      { label: 'Popups', href: '/admin/popups', icon: MonitorPlay },
    ],
  },
  {
    group: 'Platform',
    items: [{ label: 'System', href: '/admin/system', icon: Activity }],
  },
];

const PALETTE_PAGES = NAV.flatMap((g) =>
  g.items.map((i) => ({ label: i.label, href: i.href, group: g.group }))
);

export function AdminShell({
  email,
  accounts,
  children,
}: {
  email: string | null;
  /** For ⌘K. Already in the layout's cache, so this is not a new read. */
  accounts: PaletteTarget[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  // `/admin` must match exactly or it lights up on every child route.
  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const current = NAV.flatMap((g) => g.items).find((i) => isActive(i.href));

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace('/admin/login');
  };

  const openPalette = () =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
    );

  const nav = (
    <nav className="flex flex-col gap-4">
      {NAV.map((group) => (
        <div key={group.group}>
          <p className="admin-label text-muted-foreground/60 px-3 pb-1.5">
            {group.group}
          </p>
          <div className="flex flex-col">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setNavOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center gap-2.5 py-1.5 pr-3 pl-3 text-sm transition-colors',
                    active
                      ? 'bg-primary-soft text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {/* A square rail on the active item. Colour alone is
                      easy to miss when several links share a hue, and a
                      rounded pill here would fight the 2px system. */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-y-0 left-0 w-0.5',
                      active ? 'bg-primary' : 'bg-transparent'
                    )}
                  />
                  <item.icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="admin-ui bg-background text-foreground flex min-h-screen">
      <CommandPalette pages={PALETTE_PAGES} accounts={accounts} />

      {/* Desktop rail */}
      <aside className="bg-card hidden w-56 shrink-0 flex-col border-r border-(--admin-line-strong) sm:flex">
        <div className="flex items-center gap-2 border-b border-(--admin-line) px-4 py-3">
          <Terminal className="text-primary size-4" />
          <span className="admin-label text-foreground">Instant / admin</span>
        </div>

        {/* Search affordance. ⌘K is invisible until someone tells you
            about it, and this is the telling. */}
        <button
          type="button"
          onClick={openPalette}
          className="text-muted-foreground hover:text-foreground hover:bg-muted mx-2 mt-2 flex items-center gap-2 rounded-sm border border-(--admin-line) px-2 py-1.5 text-xs transition-colors"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Jump to…</span>
          <kbd className="admin-label border border-(--admin-line) px-1 py-0.5">
            ⌘K
          </kbd>
        </button>

        <div className="flex-1 overflow-y-auto py-3">{nav}</div>

        {/* A standing reminder of what this session can see. Abbreviated
            because the rail is 224px and the full phrase wraps to two
            lines, which reads as a warning rather than a footnote. */}
        <div
          className="admin-label text-muted-foreground/60 truncate border-t border-(--admin-line) px-4 py-2"
          title="Reads and writes here use the service-role key, so tenant RLS does not apply."
        >
          svc-role · rls bypassed
        </div>
      </aside>

      {/* Mobile drawer. The old header crammed all thirteen links into a
          horizontal scroll strip, which was unusable past about six. */}
      {navOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="bg-card absolute inset-y-0 left-0 w-60 overflow-y-auto py-3">
            <div className="flex items-center justify-between px-4 pb-3">
              <span className="admin-label flex items-center gap-2">
                <Terminal className="text-primary size-4" />
                Instant / admin
              </span>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                aria-label="Close navigation"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card/85 sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-(--admin-line-strong) px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="text-muted-foreground hover:text-foreground sm:hidden"
          >
            <Menu className="size-5" />
          </button>

          {/* Where you are — the old bar showed nothing, so a bookmarked
              deep link gave no context at all. */}
          <p className="admin-label text-muted-foreground truncate">
            <span className="text-foreground">
              {current?.label ?? 'Admin'}
            </span>
          </p>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={openPalette}
              aria-label="Search"
              className="text-muted-foreground hover:text-foreground sm:hidden"
            >
              <Search className="size-4" />
            </button>
            <span className="text-muted-foreground hidden font-mono text-[11px] sm:inline">
              {email}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={signOut}
              className="h-7 border-(--admin-line-strong) text-xs"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>

        <main className="admin-grid-bg min-w-0 flex-1 space-y-4 overflow-x-hidden p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
