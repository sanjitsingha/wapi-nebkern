'use client';

import { Suspense } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileForm } from '@/components/settings/profile-form';
import { PlanSection } from '@/components/settings/plan-config';
import { ActivationCodeCard } from '@/components/settings/activation-code-card';
import { PasswordForm } from '@/components/settings/password-form';
import { TwoFactorCard } from '@/components/settings/two-factor-card';
import { ConnectedAccountsCard } from '@/components/settings/connected-accounts-card';
import { SessionsCard } from '@/components/settings/sessions-card';
import { DeleteAccountCard } from '@/components/settings/delete-account-card';
import { useTabParam } from '@/components/settings/use-tab-param';

const TABS = ['profile', 'plan'] as const;

/**
 * Profile section — a tabbed shell over the account surfaces. The
 * security cards (password + connected accounts + sessions) now stack
 * under the profile form in the Profile tab rather than living in their
 * own tab, leaving just Profile and Plan.
 *
 * The active tab is bound to `?tab=` (useTabParam): deep-links like
 * /settings/profile?tab=plan land on the right panel, and switching tabs
 * updates the URL so the view is shareable. `?tab=security` is a legacy
 * value — it resolves to Profile (resolveSection), which is where its
 * cards now live. Each card keeps its own heading + description.
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
      </TabsList>

      <TabsContent value="profile">
        <div className="flex flex-col gap-6">
          <ProfileForm />
          <PasswordForm />
          {/* Directly under the password: the two are one subject —
              what it takes to get into this account — and 2FA reads as
              the answer to the risk the password card just raised. */}
          <TwoFactorCard />
          <ConnectedAccountsCard />
          <SessionsCard />
          {/* Last, and only for the owner — the card returns null for
              everyone else. */}
          <DeleteAccountCard />
        </div>
      </TabsContent>

      <TabsContent value="plan">
        <div className="flex flex-col gap-6">
          <PlanSection />
          {/* Redeeming a code changes the plan shown directly above, so
              the two belong on one screen. This used to live on Settings
              → Meta charges, wrapped in a second, thinner plan summary —
              which is what made that page look like the subscription
              screen when it is about what Meta bills for conversations. */}
          <ActivationCodeCard />
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
