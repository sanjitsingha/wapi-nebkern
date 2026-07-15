'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileForm } from '@/components/settings/profile-form';
import { PlanSection } from '@/components/settings/plan-config';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsCard } from '@/components/settings/sessions-card';

const TABS = ['profile', 'plan', 'security'] as const;
type ProfileTab = (typeof TABS)[number];

function isTab(value: string | null): value is ProfileTab {
  return !!value && (TABS as readonly string[]).includes(value);
}

/**
 * Profile section — a tabbed shell over the account surfaces. Plan &
 * subscription and the security cards (password + sessions) used to stack
 * under Profile in one long scroll; they were split into tabs to match the
 * Business Profile shell and shorten each panel.
 *
 * `?tab=` deep-links a specific tab, so old /settings/plan-style links
 * (remapped in resolveSection) can land on the right panel. Each tab renders
 * its card(s) unchanged, so each keeps its own heading + description.
 */
function ProfilePageInner() {
  const raw = useSearchParams().get('tab');
  const initial: ProfileTab = isTab(raw) ? raw : 'profile';

  return (
    <Tabs defaultValue={initial} className="animate-in fade-in-50 duration-200">
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
