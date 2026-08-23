'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QueryProvider } from '@/components/providers/query-provider';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { AvailabilityProvider } from '@/hooks/use-availability';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PresenceHeartbeat } from '@/components/presence/presence-heartbeat';
import { AppPopup } from '@/components/layout/app-popup';
import { AnnouncementBar } from '@/components/layout/announcement-bar';
import { WhatsAppConnectBanner } from '@/components/layout/whatsapp-connect-banner';
import { WalkthroughProvider } from '@/components/walkthrough/walkthrough-provider';
import { CallCenterProvider } from '@/components/calls/call-center';
import { CookieConsentModal } from '@/components/consent/cookie-consent-modal';

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
  // Defaults to expanded and only changes when the user presses the
  // toggle; the choice is persisted so it survives reloads. Read in an
  // effect (not a lazy initializer) to keep server and first client
  // render in sync.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
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
      {/* Consent first: it renders above everything and, unlike the
          admin popup below it, has no dismiss — so asking both at once
          would stack two modals with only one of them escapable. It
          returns null the moment a choice exists, which for everyone
          past their first sign-in is always. */}
      <CookieConsentModal />
      <AppPopup />
      {/* Header spans the full width at the top */}
      <Header onOpenSidebar={() => setSidebarOpen(true)} />
      {/* Admin-managed announcement bar, directly under the navbar */}
      <AnnouncementBar />
      {/* Setup nudge. The trial bar used to sit here too; it is a chip
          in the header now (billing/trial-status-chip.tsx), which
          leaves this as the only full-width band under the navbar.
          Renders nothing for anyone who cannot change settings, or once
          a number is connected. */}
      <WhatsAppConnectBanner />
      {/* Sidebar + main content side-by-side below the header */}
      <div className="flex flex-1 overflow-hidden">
        <Suspense fallback={null}>
          <Sidebar
            open={sidebarOpen}
            onClose={closeSidebar}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapsed}
          />
        </Suspense>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    // Outermost: the query cache should outlive every screen inside it,
    // which is the entire point — navigating away and back must not
    // throw the results away. It sits above AuthProvider so a signed-out
    // tree tears the cache down with it.
    <QueryProvider>
      <AuthProvider>
        <AvailabilityProvider>
          {/* Inside AuthProvider (it reads the session to decide whether
              this user has seen the tour) and outside the shell, so the
              sidebar's Walkthrough button can reach it via context. */}
          <WalkthroughProvider>
            {/* Wraps the whole shell so a call can be answered from any
                page — a ringing panel that only exists on /calls is a
                missed call everywhere else. It renders nothing until a
                call is actually in flight. */}
            <CallCenterProvider>
              <DashboardShellInner>{children}</DashboardShellInner>
            </CallCenterProvider>
          </WalkthroughProvider>
        </AvailabilityProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
