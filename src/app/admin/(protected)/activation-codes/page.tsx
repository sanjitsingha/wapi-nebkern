import { adminDb } from '../../_lib/admin-db';
import {
  ActivationCodesManager,
  type AdminActivationCode,
} from '../../_components/activation-codes-manager';

export const dynamic = 'force-dynamic';

export default async function AdminActivationCodesPage() {
  const db = adminDb();

  const [{ data: codes }, { data: plans }] = await Promise.all([
    db
      .from('activation_codes')
      .select(
        `id, code, plan_key, duration_days, max_uses, use_count, expires_at,
         is_active, note, created_at,
         plan:billing_plans(name),
         redemptions:activation_code_redemptions(redeemed_at, account:accounts(name))`,
      )
      .order('created_at', { ascending: false })
      .limit(500),
    db
      .from('billing_plans')
      .select('key, name, is_active')
      .order('sort_order', { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activation codes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate prepaid codes that activate a plan for a fixed number of
          days. Tenants redeem them in Settings → Billing; redeeming onto an
          unexpired period of the same plan extends it.
        </p>
      </div>
      <ActivationCodesManager
        codes={(codes ?? []) as unknown as AdminActivationCode[]}
        plans={(plans ?? []).map((p) => ({
          key: p.key as string,
          name: p.name as string,
          isActive: p.is_active as boolean,
        }))}
      />
    </div>
  );
}
