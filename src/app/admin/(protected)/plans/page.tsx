import {
  BILLING_PLAN_COLUMNS,
  mapBillingPlanRow,
  type BillingPlan,
} from '@/lib/billing/plans';
import { adminDb } from '../../_lib/admin-db';
import { PlansManager } from '../../_components/plans-manager';

export const dynamic = 'force-dynamic';

export default async function AdminPlansPage() {
  const { data } = await adminDb()
    .from('billing_plans')
    .select(BILLING_PLAN_COLUMNS)
    .order('sort_order', { ascending: true });

  const plans: BillingPlan[] = ((data ?? []) as Parameters<
    typeof mapBillingPlanRow
  >[0][]).map(mapBillingPlanRow);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Plans &amp; pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit what each plan costs. Changes take effect immediately for new
          assignments; accounts already on a plan keep the price agreed at
          assignment time.
        </p>
      </div>
      <PlansManager plans={plans} />
    </div>
  );
}
