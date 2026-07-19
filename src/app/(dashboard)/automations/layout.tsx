import { getCurrentAccount } from '@/lib/auth/account';
import { getAccountEntitlements } from '@/lib/billing/entitlements';
import { FeatureLockCard } from '@/components/billing/feature-gate';

/**
 * Server-side plan gate for the whole /automations section. Because it's
 * a layout, every nested route (the list, a specific automation, logs)
 * is covered — typing a URL by hand can't reach the feature on a plan
 * that excludes it. Fails OPEN on any error (unauthenticated users are
 * already redirected by middleware; a billing read blip must not hide a
 * paying tenant's data).
 */
export default async function AutomationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let allowed = true;
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const ent = await getAccountEntitlements(supabase, accountId);
    allowed = ent.allowAutomations;
  } catch {
    // fail open
  }

  if (!allowed) {
    return (
      <FeatureLockCard
        label="Automations"
        description="Trigger follow-ups, route conversations, and put routine work on autopilot. Upgrade your plan to unlock automations."
      />
    );
  }
  return <>{children}</>;
}
