import { collectSupabaseUsage } from '../../_lib/supabase-usage';
import { UsageDashboard } from '../../_components/usage-dashboard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Supabase Usage & Quotas · Admin Panel',
  description: 'Monitor live Supabase Free Tier quotas, database storage, and activity.',
};

export default async function AdminUsagePage() {
  const initial = await collectSupabaseUsage();
  return <UsageDashboard initial={initial} />;
}
