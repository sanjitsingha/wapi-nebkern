'use client';

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
  LifeBuoy,
  Activity,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NAV = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Accounts', href: '/admin/accounts', icon: Users },
  { label: 'Users', href: '/admin/users', icon: UserCog },
  { label: 'Plans', href: '/admin/plans', icon: CreditCard },
  { label: 'Activation codes', href: '/admin/activation-codes', icon: KeyRound },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell },
  { label: 'Announcements', href: '/admin/announcements', icon: Megaphone },
  { label: 'Popups', href: '/admin/popups', icon: MonitorPlay },
  { label: 'Blog', href: '/admin/blog', icon: Newspaper },
  { label: 'Tickets', href: '/admin/tickets', icon: LifeBuoy },
  { label: 'System', href: '/admin/system', icon: Activity },
] as const;

/**
 * Chrome for the admin back office — a left nav + a top bar with the
 * signed-in admin's email and a sign-out. Deliberately independent of the
 * tenant dashboard's Sidebar/Header so `src/app/admin` stays a liftable
 * unit.
 */
export function AdminShell({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace('/admin/login');
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card p-3 sm:flex">
        <div className="flex items-center gap-2 px-2 py-3">
          <ShieldCheck className="size-5 text-primary" />
          <span className="text-sm font-semibold">Admin panel</span>
        </div>
        <nav className="mt-2 flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-primary-soft text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="size-4.5 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
          {/* Mobile nav — inline links since there's no drawer here. */}
          <nav className="flex items-center gap-1 sm:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-2 py-1.5 text-xs font-medium',
                  isActive(item.href)
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
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
              Sign out
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
