import { adminDb } from '../../_lib/admin-db';
import { ADMIN_TAGS, cachedRead } from '../../_lib/admin-cache';
import { getPlans } from '../../_lib/admin-data';
import {
  ActivationCodesManager,
  type AdminActivationCode,
} from '../../_components/activation-codes-manager';
import { CacheNote, PageHeader } from '../../_components/ui';

export const dynamic = 'force-dynamic';

const getCodes = () =>
  cachedRead(ADMIN_TAGS.codes, ['all'], async () => {
    const { data } = await adminDb()
      .from('activation_codes')
      .select(
        `id, code, plan_key, duration_days, max_uses, use_count, expires_at,
         is_active, note, created_at,
         plan:billing_plans(name),
         redemptions:activation_code_redemptions(redeemed_at, account:accounts(name))`
      )
      .order('created_at', { ascending: false })
      .limit(500);

    return (data ?? []) as unknown as AdminActivationCode[];
  });

export default async function AdminActivationCodesPage() {
  // The plan list is the shared cached one — this page was fetching
  // `billing_plans` for itself alongside the Plans page doing the same.
  const [codes, plans] = await Promise.all([getCodes(), getPlans()]);

  const live = codes.filter((c) => c.is_active).length;
  const redeemed = codes.reduce((n, c) => n + (c.use_count ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Activation codes"
        description="Prepaid codes that activate a plan for a fixed number of days. Tenants redeem them in Settings → Billing; redeeming onto an unexpired period of the same plan extends it."
        meta={
          <>
            <CacheNote />
            <span>·</span>
            <span>
              {live} active / {codes.length}
            </span>
            <span>·</span>
            <span>{redeemed} redemptions</span>
          </>
        }
      />
      <ActivationCodesManager
        codes={codes}
        plans={plans.map((p) => ({
          key: p.key,
          name: p.name,
          isActive: p.isActive,
        }))}
      />
    </>
  );
}
