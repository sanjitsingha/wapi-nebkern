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
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ============================================================
// Chrome for the admin back office.
//
// The nav was thirteen equal-weight links in one flat column, which
// meant scanning all thirteen to find any one of them. Grouped into
// the four jobs the panel actually does — running tenants, answering
// people, publishing things, keeping the lights on — so you look in a
// section of three or four instead.
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

export function AdminShell({
  email,
  children,
}: {
  email: string | null;
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

  const nav = (
    <nav className="flex flex-col gap-5">
      {NAV.map((group) => (
        <div key={group.group}>
          <p className="text-muted-foreground/70 px-3 pb-1.5 text-[10px] font-semibold tracking-wider uppercase">
            {group.group}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setNavOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {/* A rail on the active item — colour alone is easy to
                      miss when several links share a hue. */}
                  {active && (
                    <span
                      aria-hidden
                      className="bg-primary absolute top-1.5 bottom-1.5 -left-px w-0.5 rounded-full"
                    />
                  )}
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
    <div className="bg-background text-foreground flex min-h-screen">
      {/* Desktop rail */}
      <aside className="border-border bg-card hidden w-60 shrink-0 flex-col border-r sm:flex">
        <div className="flex items-center gap-2 px-5 py-4">
          <ShieldCheck className="text-primary size-5" />
          <span className="text-sm font-semibold">Admin panel</span>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">{nav}</div>
      </aside>

      {/* Mobile drawer. The old header crammed all thirteen links into a
          horizontal scroll strip, which was unusable past about six. */}
      {navOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="bg-card absolute inset-y-0 left-0 w-64 overflow-y-auto p-3">
            <div className="flex items-center justify-between px-2 pb-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="text-primary size-5" />
                Admin panel
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
        <header className="border-border bg-card/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur">
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
          <p className="text-foreground truncate text-sm font-medium">
            {current?.label ?? 'Admin'}
          </p>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-muted-foreground hidden text-xs sm:inline">
              {email}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={signOut}
              className="border-border"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
