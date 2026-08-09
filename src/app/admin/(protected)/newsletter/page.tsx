import { adminDb } from '../../_lib/admin-db';
import {
  NewsletterTable,
  type SubscriberRow,
} from '../../_components/newsletter-table';
import {
  isUnsubscribeConfigured,
  unsubscribeUrl,
} from '@/lib/newsletter-unsubscribe';

export const dynamic = 'force-dynamic';

export default async function AdminNewsletterPage() {
  const { data } = await adminDb()
    .from('newsletter_subscribers')
    .select('id, email, name, status, source_path, created_at')
    .order('created_at', { ascending: false })
    .limit(2000);

  // Signed here, not in the browser: the HMAC secret is server-only.
  const signed = isUnsubscribeConfigured();
  const rows = ((data ?? []) as Omit<SubscriberRow, 'unsubscribe_url'>[]).map(
    (r) => ({
      ...r,
      unsubscribe_url: signed ? unsubscribeUrl(r.email) : null,
    })
  ) as SubscriberRow[];

  const active = rows.filter((r) => r.status === 'subscribed').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">Newsletter</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {active} active {active === 1 ? 'subscriber' : 'subscribers'}
          {rows.length !== active && ` · ${rows.length - active} unsubscribed`}
        </p>
        {!signed && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            UNSUBSCRIBE_SECRET is not set, so unsubscribe links cannot be
            signed. Set it before sending anything — the link has to be in every
            email.
          </p>
        )}
      </div>

      <NewsletterTable rows={rows} />
    </div>
  );
}
