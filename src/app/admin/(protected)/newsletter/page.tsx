import { adminDb } from '../../_lib/admin-db';
import { ADMIN_TAGS, cachedRead } from '../../_lib/admin-cache';
import {
  NewsletterTable,
  type SubscriberRow,
} from '../../_components/newsletter-table';
import {
  isUnsubscribeConfigured,
  unsubscribeUrl,
} from '@/lib/newsletter-unsubscribe';
import { CacheNote, PageHeader } from '../../_components/ui';

export const dynamic = 'force-dynamic';

type RawSubscriber = Omit<SubscriberRow, 'unsubscribe_url'>;

// Only the rows are cached, not the signed links. The HMAC is cheap to
// recompute and caching signatures means caching a secret-derived value
// in Next's data cache, which is not somewhere secrets should go.
const getSubscribers = () =>
  cachedRead(ADMIN_TAGS.newsletter, ['all'], async () => {
    const { data } = await adminDb()
      .from('newsletter_subscribers')
      .select('id, email, name, status, source_path, created_at')
      .order('created_at', { ascending: false })
      .limit(2000);

    return (data ?? []) as RawSubscriber[];
  });

export default async function AdminNewsletterPage() {
  const raw = await getSubscribers();

  // Signed here, not in the browser: the HMAC secret is server-only.
  const signed = isUnsubscribeConfigured();
  const rows = raw.map((r) => ({
    ...r,
    unsubscribe_url: signed ? unsubscribeUrl(r.email) : null,
  })) as SubscriberRow[];

  const active = rows.filter((r) => r.status === 'subscribed').length;

  return (
    <>
      <PageHeader
        title="Newsletter"
        description="Everyone who opted in from the marketing site."
        meta={
          <>
            <CacheNote />
            <span>·</span>
            <span>
              {active} active {active === 1 ? 'subscriber' : 'subscribers'}
            </span>
            {rows.length !== active && (
              <>
                <span>·</span>
                <span>{rows.length - active} unsubscribed</span>
              </>
            )}
          </>
        }
      />

      {!signed && (
        <p className="rounded-sm border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          UNSUBSCRIBE_SECRET is not set, so unsubscribe links cannot be signed.
          Set it before sending anything — the link has to be in every email.
        </p>
      )}

      <NewsletterTable rows={rows} />
    </>
  );
}
