import ExcelJS from 'exceljs';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

// ============================================================
// GET /api/broadcasts/<id>/report — the campaign report, as .xlsx.
//
// Built server-side rather than in the browser for two reasons: ExcelJS
// is far too heavy to ship to every page that might offer a download,
// and the recipient list has to be paged. The detail page holds only the
// first page of recipients (PostgREST caps an unbounded select at 1000
// rows); a report that silently stopped at row 1000 would be worse than
// no report at all, so this walks the whole table in chunks.
//
// Scoping is by account_id off getCurrentAccount() *and* RLS underneath,
// so one tenant can't export another's campaign by guessing an id.
// ============================================================

export const runtime = 'nodejs';

/** PostgREST's own ceiling for one request. */
const PAGE = 1000;
/** Hard stop, so a pathological row count can't hold a worker forever. */
const MAX_ROWS = 100_000;

type RecipientRow = {
  status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  error_message: string | null;
  whatsapp_message_id: string | null;
  contact: { name: string | null; phone: string | null; email: string | null } | null;
};

/** Excel wants a real Date to apply a date format; anything unparseable
 *  becomes blank rather than the string "Invalid Date". */
function toDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pct = (num: number, den: number) =>
  den > 0 ? Math.round((num / den) * 100) / 100 : 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, accountId } = await getCurrentAccount();

    const { data: broadcast, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) throw error;
    if (!broadcast) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Walk the recipients in pages until a short page says we're done.
    const recipients: RecipientRow[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error: recErr } = await supabase
        .from('broadcast_recipients')
        .select(
          'status, sent_at, delivered_at, read_at, replied_at, error_message, whatsapp_message_id, contact:contacts(name, phone, email)',
        )
        .eq('broadcast_id', id)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1);

      if (recErr) throw recErr;
      const page = (data ?? []) as unknown as RecipientRow[];
      recipients.push(...page);
      if (page.length < PAGE) break;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'wacrm';
    wb.created = new Date();

    /* ── Sheet 1: the headline numbers ── */
    const summary = wb.addWorksheet('Summary');
    summary.columns = [
      { header: 'Metric', key: 'metric', width: 26 },
      { header: 'Value', key: 'value', width: 40 },
    ];

    const sent = broadcast.sent_count ?? 0;
    const delivered = broadcast.delivered_count ?? 0;
    const read = broadcast.read_count ?? 0;
    const replied = broadcast.replied_count ?? 0;
    const failed = broadcast.failed_count ?? 0;
    const total = broadcast.total_recipients ?? 0;

    summary.addRows([
      { metric: 'Campaign', value: broadcast.name },
      { metric: 'Status', value: broadcast.status },
      { metric: 'Template', value: broadcast.template_name },
      { metric: 'Template language', value: broadcast.template_language },
      { metric: 'Created', value: toDate(broadcast.created_at) },
      { metric: 'Scheduled for', value: toDate(broadcast.scheduled_at) },
      { metric: 'Report generated', value: new Date() },
      {},
      { metric: 'Total recipients', value: total },
      { metric: 'Sent', value: sent },
      { metric: 'Delivered', value: delivered },
      { metric: 'Read', value: read },
      { metric: 'Replied', value: replied },
      { metric: 'Failed', value: failed },
      {},
      // Written as real fractions with a % number format, so they stay
      // numbers Excel can chart rather than text like "83%".
      { metric: 'Delivery rate', value: pct(delivered, sent) },
      { metric: 'Open rate', value: pct(read, delivered) },
      { metric: 'Response rate', value: pct(replied, delivered) },
      { metric: 'Failure rate', value: pct(failed, total) },
    ]);

    summary.getRow(1).font = { bold: true };
    summary.getColumn('metric').font = { bold: false };
    for (const r of [6, 7, 8]) {
      summary.getCell(`B${r}`).numFmt = 'yyyy-mm-dd hh:mm';
    }
    for (let r = 17; r <= 20; r += 1) {
      summary.getCell(`B${r}`).numFmt = '0%';
    }

    /* ── Sheet 2: one row per recipient ── */
    const sheet = wb.addWorksheet('Recipients');
    sheet.columns = [
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Sent at', key: 'sent', width: 20 },
      { header: 'Delivered at', key: 'delivered', width: 20 },
      { header: 'Read at', key: 'read', width: 20 },
      { header: 'Replied at', key: 'replied', width: 20 },
      { header: 'Error', key: 'error', width: 36 },
      { header: 'WhatsApp message ID', key: 'wamid', width: 34 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const r of recipients) {
      sheet.addRow({
        name: r.contact?.name ?? '',
        // Leading apostrophe would be visible; instead let Excel keep the
        // phone as text via the column format below.
        phone: r.contact?.phone ?? '',
        email: r.contact?.email ?? '',
        status: r.status ?? '',
        sent: toDate(r.sent_at),
        delivered: toDate(r.delivered_at),
        read: toDate(r.read_at),
        replied: toDate(r.replied_at),
        error: r.error_message ?? '',
        wamid: r.whatsapp_message_id ?? '',
      });
    }

    // Phone numbers are text: a +91… would otherwise be coerced to a
    // number and lose its leading +, and long numbers go scientific.
    sheet.getColumn('phone').numFmt = '@';
    for (const key of ['sent', 'delivered', 'read', 'replied']) {
      sheet.getColumn(key).numFmt = 'yyyy-mm-dd hh:mm';
    }
    if (recipients.length > 0) {
      sheet.autoFilter = { from: 'A1', to: { row: 1, column: 10 } };
    }

    const buffer = await wb.xlsx.writeBuffer();

    // Slugged campaign name + date, so a folder of these stays readable.
    const slug =
      String(broadcast.name ?? 'campaign')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'campaign';
    const filename = `${slug}-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

    // ExcelJS types this as its own `Buffer`, which lines up with neither
    // the DOM `BodyInit` nor Node's Buffer. Normalising through
    // Uint8Array is correct for both shapes it actually returns — it
    // wraps an ArrayBuffer and copies a Node Buffer — instead of
    // asserting a type the value may not have.
    return new Response(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
