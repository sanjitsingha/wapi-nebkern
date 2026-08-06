import { adminDb } from '../../_lib/admin-db';
import {
  NewsletterTable,
  type SubscriberRow,
} from '../../_components/newsletter-table';

export const dynamic = 'force-dynamic';

export default async function AdminNewsletterPage() {
  const { data } = await adminDb()
    .from('newsletter_subscribers')
    .select('id, email, name, status, source_path, created_at')
    .order('created_at', { ascending: false })
    .limit(2000);

  const rows = (data ?? []) as SubscriberRow[];
  const active = rows.filter((r) => r.status === 'subscribed').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">Newsletter</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {active} active {active === 1 ? 'subscriber' : 'subscribers'}
          {rows.length !== active && ` · ${rows.length - active} unsubscribed`}
        </p>
      </div>

      <NewsletterTable rows={rows} />
    </div>
  );
}
