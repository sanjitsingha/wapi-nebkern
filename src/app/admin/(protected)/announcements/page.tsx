import { adminDb } from '../../_lib/admin-db';
import { ADMIN_TAGS, cachedRead } from '../../_lib/admin-cache';
import { getAccountsIndex } from '../../_lib/admin-data';
import {
  AnnouncementsManager,
  type AnnouncementView,
} from '../../_components/announcements-manager';
import { CacheNote, PageHeader } from '../../_components/ui';
import type { AnnouncementVariant } from '@/lib/app-announcement';

export const dynamic = 'force-dynamic';

interface AnnouncementRow {
  id: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  variant: AnnouncementVariant;
  dismissible: boolean;
  audience: 'all' | 'account';
  account_id: string | null;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const getAnnouncements = () =>
  cachedRead(ADMIN_TAGS.announcements, ['all'], async () => {
    const { data } = await adminDb()
      .from('app_announcements')
      .select(
        'id, message, link_url, link_label, variant, dismissible, audience, account_id, is_active, starts_at, expires_at, created_at'
      )
      .order('created_at', { ascending: false });

    return (data ?? []) as AnnouncementRow[];
  });

export default async function AdminAnnouncementsPage() {
  // The account list comes from the shared cached loader rather than a
  // second query here — four other pages want the same rows.
  const [rows, accounts] = await Promise.all([
    getAnnouncements(),
    getAccountsIndex(),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const announcements: AnnouncementView[] = rows.map((a) => ({
    id: a.id,
    message: a.message,
    linkUrl: a.link_url,
    linkLabel: a.link_label,
    variant: a.variant,
    dismissible: a.dismissible,
    audience: a.audience,
    accountId: a.account_id,
    accountName: a.account_id ? (accountName.get(a.account_id) ?? null) : null,
    isActive: a.is_active,
    startsAt: a.starts_at,
    expiresAt: a.expires_at,
    createdAt: a.created_at,
  }));

  const live = announcements.filter((a) => a.isActive).length;

  return (
    <>
      <PageHeader
        title="Announcement bar"
        description="A slim bar shown under the tenant's dashboard navbar — for plan reminders, maintenance notices, and product news. Severity sets the colour; add an optional link and expiry."
        meta={
          <>
            <CacheNote />
            <span>·</span>
            <span>
              {live} live / {announcements.length}
            </span>
          </>
        }
      />
      <AnnouncementsManager announcements={announcements} accounts={accounts} />
    </>
  );
}
