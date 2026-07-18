import { adminDb } from '../../_lib/admin-db';
import {
  PopupsManager,
  type PopupView,
  type AccountOption,
} from '../../_components/popups-manager';

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

export default async function AdminPopupsPage() {
  const db = adminDb();

  const [popupsRes, accountsRes] = await Promise.all([
    db
      .from('app_popups')
      .select(
        'id, title, body, image_url, youtube_url, link_url, link_label, audience, account_id, is_active, starts_at, expires_at, created_at',
      )
      .order('created_at', { ascending: false }),
    db.from('accounts').select('id, name').order('name', { ascending: true }),
  ]);

  const accounts = (accountsRes.data ?? []) as AccountOption[];
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const popups: PopupView[] = ((popupsRes.data ?? []) as PopupRow[]).map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    imageUrl: p.image_url,
    youtubeUrl: p.youtube_url,
    linkUrl: p.link_url,
    linkLabel: p.link_label,
    audience: p.audience,
    accountId: p.account_id,
    accountName: p.account_id ? (accountName.get(p.account_id) ?? null) : null,
    isActive: p.is_active,
    startsAt: p.starts_at,
    expiresAt: p.expires_at,
    createdAt: p.created_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">App popups</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A splash modal shown when a tenant opens the app. Supports text,
          image, a YouTube video, and a link — any combination.
        </p>
      </div>
      <PopupsManager popups={popups} accounts={accounts} />
    </div>
  );
}
