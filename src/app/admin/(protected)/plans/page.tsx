import { getPlans } from '../../_lib/admin-data';
import { PlansManager } from '../../_components/plans-manager';
import { CacheNote, PageHeader } from '../../_components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPlansPage() {
  const plans = await getPlans();
  const active = plans.filter((p) => p.isActive).length;

  return (
    <>
      <PageHeader
        title="Plans & pricing"
        description="Edit what each plan costs. Changes take effect immediately for new assignments; accounts already on a plan keep the price agreed at assignment time."
        meta={
          <>
            <CacheNote />
            <span>·</span>
            <span>
              {active} active / {plans.length}
            </span>
          </>
        }
      />
      <PlansManager plans={plans} />
    </>
  );
}
