import { collectSystemHealth } from '../../_lib/system-health';
import { SystemHealthConsole } from '../../_components/system-health-console';

export const dynamic = 'force-dynamic';

export default async function AdminSystemPage() {
  const initial = await collectSystemHealth();
  return <SystemHealthConsole initial={initial} />;
}
