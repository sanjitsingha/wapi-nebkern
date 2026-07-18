'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { AvailabilityProvider } from '@/hooks/use-availability';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PresenceHeartbeat } from '@/components/presence/presence-heartbeat';
import { TrialBanner } from '@/components/billing/trial-banner';
import { AppPopup } from '@/components/layout/app-popup';
import { AnnouncementBar } from '@/components/layout/announcement-bar';

// Auth-gated dashboard shell. Extracted from the layout so the layout
// itself can stay a server component and export metadata (noindex) —
// client components can't export Next's metadata object.

// localStorage key for the desktop sidebar collapse preference.
const SIDEBAR_COLLAPSED_KEY = 'wacrm.sidebar-collapsed';

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Sidebar drawer state — only used on mobile. On lg+ the sidebar is
  // always visible and this stays at `false` (ignored by the component).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Desktop-only collapse state — shrinks the sidebar to an icon rail.
  // Persisted so the choice survives reloads. Read in an effect (not a
  // lazy initializer) to keep server and first client render in sync.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      <PresenceHeartbeat />
      <AppPopup />
      {/* Header spans the full width at the top */}
      <Header onOpenSidebar={() => setSidebarOpen(true)} />
      {/* Admin-managed announcement bar, directly under the navbar */}
      <AnnouncementBar />
      {/* Trial/subscription status bar, below the announcement bar */}
      <TrialBanner />
      {/* Sidebar + main content side-by-side below the header */}
      <div className="flex flex-1 overflow-hidden">
        <Suspense fallback={null}>
          <Sidebar
            open={sidebarOpen}
            onClose={closeSidebar}
            collapsed={collapsed}
          />
        </Suspense>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AvailabilityProvider>
        <DashboardShellInner>{children}</DashboardShellInner>
      </AvailabilityProvider>
    </AuthProvider>
  );
}
