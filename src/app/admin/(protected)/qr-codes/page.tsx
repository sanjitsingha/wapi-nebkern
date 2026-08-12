import { adminDb } from '../../_lib/admin-db';
import { ADMIN_TAGS, cachedRead } from '../../_lib/admin-cache';
import {
  QrGenerationsTable,
  type QrGenerationRow,
} from '../../_components/qr-generations-table';
import { CacheNote, PageHeader } from '../../_components/ui';

export const dynamic = 'force-dynamic';

// Every row is someone who typed a WhatsApp number into the free tool
// at /qr-generator. Nothing writes to this table from the panel, so
// there is no `revalidateAdmin` call anywhere for `ADMIN_TAGS.qr` —
// the 60s TTL is the only thing that refreshes it, which is right for
// a feed the operator reads and never edits.

const getGenerations = () =>
  cachedRead(ADMIN_TAGS.qr, ['all'], async () => {
    const { data } = await adminDb()
      .from('qr_generations')
      .select('id, phone, message, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    return (data ?? []) as QrGenerationRow[];
  });

/** Rows created in the last `hours`. */
function since(rows: QrGenerationRow[], hours: number): number {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return rows.filter((r) => Date.parse(r.created_at) >= cutoff).length;
}

export default async function AdminQrCodesPage() {
  const rows = await getGenerations();

  // Distinct numbers, not rows: one person iterating on their message
  // generates five codes and is still one lead.
  const uniqueNumbers = new Set(rows.map((r) => r.phone)).size;

  return (
    <>
      <PageHeader
        title="QR generator"
        description="Codes made with the free public tool at /qr-generator. Each one is a business that typed its own WhatsApp number into our site."
        meta={
          <>
            <CacheNote />
            <span>·</span>
            <span>{rows.length} generated</span>
            <span>·</span>
            <span>{uniqueNumbers} unique numbers</span>
            <span>·</span>
            <span>{since(rows, 24)} in 24h</span>
            <span>·</span>
            <span>{since(rows, 24 * 7)} in 7d</span>
          </>
        }
      />
      <QrGenerationsTable rows={rows} />
    </>
  );
}
