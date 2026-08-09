import { adminDb } from '../../_lib/admin-db';
import { getAccountsIndex } from '../../_lib/admin-data';
import {
  AnnouncementsManager,
  type AnnouncementView,
} from '../../_components/announcements-manager';
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

export default async function AdminAnnouncementsPage() {
  const db = adminDb();

  // The account list comes from the shared cached loader rather than a
  // second query here — four other pages want the same rows.
  const [announcementsRes, accounts] = await Promise.all([
    db
      .from('app_announcements')
      .select(
        'id, message, link_url, link_label, variant, dismissible, audience, account_id, is_active, starts_at, expires_at, created_at'
      )
      .order('created_at', { ascending: false }),
    getAccountsIndex(),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const announcements: AnnouncementView[] = (
    (announcementsRes.data ?? []) as AnnouncementRow[]
  ).map((a) => ({
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">Announcement bar</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          A slim bar shown under the tenant&apos;s dashboard navbar — for plan
          reminders, maintenance notices, and product news. Severity sets the
          colour; add an optional link and expiry.
        </p>
      </div>
      <AnnouncementsManager announcements={announcements} accounts={accounts} />
    </div>
  );
}
