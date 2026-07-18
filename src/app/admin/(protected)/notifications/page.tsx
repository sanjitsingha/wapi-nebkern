import { adminDb } from '../../_lib/admin-db';
import {
  NotificationsManager,
  type AdminNotificationView,
  type AccountOption,
} from '../../_components/notifications-manager';

export const dynamic = 'force-dynamic';

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  href: string | null;
  image_url: string | null;
  audience: 'all' | 'account';
  account_id: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export default async function AdminNotificationsPage() {
  const db = adminDb();

  const [notifsRes, accountsRes] = await Promise.all([
    db
      .from('admin_notifications')
      .select('id, title, body, href, image_url, audience, account_id, is_active, expires_at, created_at')
      .order('created_at', { ascending: false }),
    db.from('accounts').select('id, name').order('name', { ascending: true }),
  ]);

  const accounts = (accountsRes.data ?? []) as AccountOption[];
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const notifications: AdminNotificationView[] = (
    (notifsRes.data ?? []) as NotificationRow[]
  ).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    href: n.href,
    imageUrl: n.image_url,
    audience: n.audience,
    accountId: n.account_id,
    accountName: n.account_id ? (accountName.get(n.account_id) ?? null) : null,
    isActive: n.is_active,
    expiresAt: n.expires_at,
    createdAt: n.created_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send an announcement to every account, or target one. It appears in
          the tenant&apos;s notification bell.
        </p>
      </div>
      <NotificationsManager notifications={notifications} accounts={accounts} />
    </div>
  );
}
