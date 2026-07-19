import { getCurrentAccount } from '@/lib/auth/account';
import { getAccountEntitlements } from '@/lib/billing/entitlements';
import { FeatureLockCard } from '@/components/billing/feature-gate';

/**
 * Server-side plan gate for the whole /flows section — the list, the
 * builder, templates, run logs. A hand-typed URL can't reach the feature
 * on a plan that excludes it. Fails OPEN on any error (middleware
 * handles unauthenticated; billing blips must not lock paying tenants
 * out).
 */
export default async function FlowsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let allowed = true;
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const ent = await getAccountEntitlements(supabase, accountId);
    allowed = ent.allowFlows;
  } catch {
    // fail open
  }

  if (!allowed) {
    return (
      <FeatureLockCard
        label="Flows"
        description="Build no-code chatbot journeys with buttons and menus. Upgrade your plan to unlock flows."
      />
    );
  }
  return <>{children}</>;
}
