'use client';

import { Suspense } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileForm } from '@/components/settings/profile-form';
import { PlanSection } from '@/components/settings/plan-config';
import { PasswordForm } from '@/components/settings/password-form';
import { ConnectedAccountsCard } from '@/components/settings/connected-accounts-card';
import { SessionsCard } from '@/components/settings/sessions-card';
import { useTabParam } from '@/components/settings/use-tab-param';

const TABS = ['profile', 'plan', 'security'] as const;

/**
 * Profile section — a tabbed shell over the account surfaces. Plan &
 * subscription and the security cards (password + sessions) used to stack
 * under Profile in one long scroll; they were split into tabs to match the
 * Business Profile shell and shorten each panel.
 *
 * The active tab is bound to `?tab=` (useTabParam): deep-links like
 * /settings/profile?tab=plan land on the right panel, and switching tabs
 * updates the URL so the view is shareable. Each tab renders its card(s)
 * unchanged, so each keeps its own heading + description.
 */
function ProfilePageInner() {
  const [tab, setTab] = useTabParam(TABS);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(String(value))}
      className="animate-in fade-in-50 duration-200"
    >
      <TabsList variant="line" className="mb-5 gap-4 bg-transparent p-0">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="plan">Plan</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileForm />
      </TabsContent>

      <TabsContent value="plan">
        <PlanSection />
      </TabsContent>

      <TabsContent value="security">
        <div className="flex flex-col gap-6">
          <PasswordForm />
          <ConnectedAccountsCard />
          <SessionsCard />
        </div>
      </TabsContent>
    </Tabs>
  );
}

// useSearchParams opts the tree out of static prerendering unless it sits
// under a Suspense boundary — same pattern as /login.
export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageInner />
    </Suspense>
  );
}
