import { adminDb } from '../../_lib/admin-db';
import { ADMIN_TAGS, cachedRead } from '../../_lib/admin-cache';
import { getAccountsIndex } from '../../_lib/admin-data';
import {
  PopupsManager,
  type PopupView,
} from '../../_components/popups-manager';
import { CacheNote, PageHeader } from '../../_components/ui';

export const dynamic = 'force-dynamic';

interface PopupRow {
  id: string;
  title: string | null;
  body: string | null;
  image_url: string | null;
  youtube_url: string | null;
  link_url: string | null;
  link_label: string | null;
  audience: 'all' | 'account';
  account_id: string | null;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const getPopups = () =>
  cachedRead(ADMIN_TAGS.popups, ['all'], async () => {
    const { data } = await adminDb()
      .from('app_popups')
      .select(
        'id, title, body, image_url, youtube_url, link_url, link_label, audience, account_id, is_active, starts_at, expires_at, created_at'
      )
      .order('created_at', { ascending: false });

    return (data ?? []) as PopupRow[];
  });

export default async function AdminPopupsPage() {
  // Shared cached account list — see `_lib/admin-data.ts`.
  const [rows, accounts] = await Promise.all([getPopups(), getAccountsIndex()]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const popups: PopupView[] = rows.map(
    (p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      imageUrl: p.image_url,
      youtubeUrl: p.youtube_url,
      linkUrl: p.link_url,
      linkLabel: p.link_label,
      audience: p.audience,
      accountId: p.account_id,
      accountName: p.account_id
        ? (accountName.get(p.account_id) ?? null)
        : null,
      isActive: p.is_active,
      startsAt: p.starts_at,
      expiresAt: p.expires_at,
      createdAt: p.created_at,
    })
  );

  const live = popups.filter((p) => p.isActive).length;

  return (
    <>
      <PageHeader
        title="App popups"
        description="A splash modal shown when a tenant opens the app. Supports text, image, a YouTube video, and a link — any combination."
        meta={
          <>
            <CacheNote />
            <span>·</span>
            <span>
              {live} live / {popups.length}
            </span>
          </>
        }
      />
      <PopupsManager popups={popups} accounts={accounts} />
    </>
  );
}
