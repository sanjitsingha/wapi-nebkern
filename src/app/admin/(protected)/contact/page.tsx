import { adminDb } from '../../_lib/admin-db';
import { ADMIN_TAGS, cachedRead } from '../../_lib/admin-cache';
import {
  ContactSubmissionsTable,
  type ContactRow,
} from '../../_components/contact-submissions-table';
import { CacheNote, PageHeader } from '../../_components/ui';

export const dynamic = 'force-dynamic';

const getSubmissions = () =>
  cachedRead(ADMIN_TAGS.contact, ['all'], async () => {
    const { data } = await adminDb()
      .from('contact_submissions')
      .select(
        'id, name, email, phone, company, message, status, source_path, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(500);

    return (data ?? []) as ContactRow[];
  });

export default async function AdminContactPage() {
  const rows = await getSubmissions();
  const unread = rows.filter((r) => r.status === 'new').length;

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="Submissions from the public /contact form."
        meta={
          <>
            <CacheNote />
            <span>·</span>
            <span>{rows.length} total</span>
            {unread > 0 && (
              <>
                <span>·</span>
                <span className="text-foreground">{unread} new</span>
              </>
            )}
          </>
        }
      />
      <ContactSubmissionsTable rows={rows} />
    </>
  );
}
