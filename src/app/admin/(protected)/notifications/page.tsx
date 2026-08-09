import { adminDb } from '../../_lib/admin-db';
import { ADMIN_TAGS, cachedRead } from '../../_lib/admin-cache';
import { getAccountsIndex } from '../../_lib/admin-data';
import {
  NotificationsManager,
  type AdminNotificationView,
} from '../../_components/notifications-manager';
import { CacheNote, PageHeader } from '../../_components/ui';

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

const getNotifications = () =>
  cachedRead(ADMIN_TAGS.notifications, ['all'], async () => {
    const { data } = await adminDb()
      .from('admin_notifications')
      .select(
        'id, title, body, href, image_url, audience, account_id, is_active, expires_at, created_at'
      )
      .order('created_at', { ascending: false });

    return (data ?? []) as NotificationRow[];
  });

export default async function AdminNotificationsPage() {
  // Shared cached account list — see `_lib/admin-data.ts`.
  const [rows, accounts] = await Promise.all([
    getNotifications(),
    getAccountsIndex(),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const notifications: AdminNotificationView[] = rows.map((n) => ({
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

  const live = notifications.filter((n) => n.isActive).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Send an announcement to every account, or target one. It appears in the tenant's notification bell."
        meta={
          <>
            <CacheNote />
            <span>·</span>
            <span>
              {live} live / {notifications.length}
            </span>
          </>
        }
      />
      <NotificationsManager notifications={notifications} accounts={accounts} />
    </>
  );
}
