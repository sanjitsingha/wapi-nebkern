import { adminDb } from '../../_lib/admin-db';
import {
  ContactSubmissionsTable,
  type ContactRow,
} from '../../_components/contact-submissions-table';

export const dynamic = 'force-dynamic';

export default async function AdminContactPage() {
  const { data } = await adminDb()
    .from('contact_submissions')
    .select(
      'id, name, email, phone, company, message, status, source_path, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(500);

  const rows = (data ?? []) as ContactRow[];
  const unread = rows.filter((r) => r.status === 'new').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">Enquiries</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Submissions from the public /contact form.
          {unread > 0 && (
            <>
              {' '}
              <span className="text-foreground font-medium">{unread} new</span>.
            </>
          )}
        </p>
      </div>

      <ContactSubmissionsTable rows={rows} />
    </div>
  );
}
