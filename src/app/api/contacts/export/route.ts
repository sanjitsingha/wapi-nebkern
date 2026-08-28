import ExcelJS from 'exceljs';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import type { Contact } from '@/types';

export const runtime = 'nodejs';

/** PostgREST page limit */
const PAGE = 1000;
const MAX_ROWS = 50_000;

interface ExportRequestBody {
  format?: 'xlsx' | 'csv';
  ids?: string[];
  search?: string;
  tagIds?: string[];
  optedOutOnly?: boolean;
  createdFrom?: string;
  createdTo?: string;
  createdSort?: 'asc' | 'desc';
}

function nextDayISO(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function toCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  const escapeCell = (
    val: string | number | boolean | null | undefined,
  ): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const body: ExportRequestBody = await request.json().catch(() => ({}));
    const format = body.format === 'csv' ? 'csv' : 'xlsx';
    const selectedIds = Array.isArray(body.ids) && body.ids.length > 0 ? body.ids : null;

    // 1. Fetch tags lookup
    const { data: allTags } = await supabase.from('tags').select('id, name');
    const tagsMap = new Map<string, string>();
    allTags?.forEach((t) => tagsMap.set(t.id, t.name));

    // 2. Fetch custom fields lookup
    const { data: customFields } = await supabase
      .from('custom_fields')
      .select('id, field_name')
      .order('created_at', { ascending: true });
    const customFieldList = customFields ?? [];

    // 3. Fetch contacts
    const contacts: Contact[] = [];

    if (selectedIds) {
      // Export specific selected contacts
      for (let i = 0; i < selectedIds.length; i += PAGE) {
        const batchIds = selectedIds.slice(i, i + PAGE);
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('account_id', accountId)
          .in('id', batchIds);
        if (error) throw error;
        if (data) contacts.push(...data);
      }
    } else if (body.tagIds && body.tagIds.length > 0) {
      // Filter by tags using the database RPC
      for (let from = 0; from < MAX_ROWS; from += PAGE) {
        const { data, error } = await supabase.rpc('filter_contacts_by_tags', {
          p_tag_ids: body.tagIds,
          p_search: body.search?.trim() || null,
          p_limit: PAGE,
          p_offset: from,
          p_created_from: body.createdFrom || null,
          p_created_to: body.createdTo || null,
          p_opted_out: body.optedOutOnly ? true : null,
        });
        if (error) throw error;
        const rows = (data ?? []) as { contact: Contact }[];
        contacts.push(...rows.map((r) => r.contact));
        if (rows.length < PAGE) break;
      }
    } else {
      // Export all / filtered contacts
      for (let from = 0; from < MAX_ROWS; from += PAGE) {
        let query = supabase
          .from('contacts')
          .select('*')
          .eq('account_id', accountId)
          .order('created_at', { ascending: body.createdSort === 'asc' })
          .range(from, from + PAGE - 1);

        const term = body.search?.trim();
        if (term) {
          const like = `%${term}%`;
          query = query.or(
            `name.ilike.${like},phone.ilike.${like},email.ilike.${like}`,
          );
        }
        if (body.createdFrom) {
          query = query.gte('created_at', body.createdFrom);
        }
        if (body.createdTo) {
          query = query.lt('created_at', nextDayISO(body.createdTo));
        }
        if (body.optedOutOnly) {
          query = query.eq('marketing_opt_out', true);
        }

        const { data, error } = await query;
        if (error) throw error;
        const batch = data ?? [];
        contacts.push(...batch);
        if (batch.length < PAGE) break;
      }
    }

    if (contacts.length === 0) {
      return Response.json(
        { error: 'No contacts found to export' },
        { status: 400 },
      );
    }

    // 4. Batch-fetch tags for the exported contacts
    const contactIds = contacts.map((c) => c.id);
    const contactTagsMap = new Map<string, string[]>();
    for (let i = 0; i < contactIds.length; i += PAGE) {
      const batch = contactIds.slice(i, i + PAGE);
      const { data: ctData } = await supabase
        .from('contact_tags')
        .select('contact_id, tag_id')
        .in('contact_id', batch);
      ctData?.forEach((ct) => {
        const tagName = tagsMap.get(ct.tag_id);
        if (tagName) {
          const list = contactTagsMap.get(ct.contact_id) ?? [];
          list.push(tagName);
          contactTagsMap.set(ct.contact_id, list);
        }
      });
    }

    // 5. Batch-fetch custom values for the exported contacts
    const customValuesMap = new Map<string, Map<string, string>>();
    if (customFieldList.length > 0) {
      for (let i = 0; i < contactIds.length; i += PAGE) {
        const batch = contactIds.slice(i, i + PAGE);
        const { data: cvData } = await supabase
          .from('contact_custom_values')
          .select('contact_id, field_id, value')
          .in('contact_id', batch);
        cvData?.forEach((cv) => {
          let fields = customValuesMap.get(cv.contact_id);
          if (!fields) {
            fields = new Map();
            customValuesMap.set(cv.contact_id, fields);
          }
          fields.set(cv.field_id, cv.value);
        });
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filePrefix = selectedIds ? 'contacts-selected' : 'contacts-export';

    if (format === 'csv') {
      const headers = [
        'Name',
        'Phone',
        'Email',
        'Company',
        'Date of Birth',
        'Marital Status',
        'Spouse Name',
        'Country',
        'State',
        'City',
        'Locality',
        'Street',
        'Pin Code',
        'Tags',
        'Marketing Consent',
        'Status',
        'Created At',
        ...customFieldList.map((cf) => cf.field_name),
      ];

      const rows = contacts.map((c) => [
        c.name ?? '',
        c.phone ?? '',
        c.email ?? '',
        c.company ?? '',
        c.date_of_birth ?? '',
        c.marital_status ?? '',
        c.spouse_name ?? '',
        c.country ?? '',
        c.state ?? '',
        c.city ?? '',
        c.locality ?? '',
        c.street ?? '',
        c.pin_code ?? '',
        (contactTagsMap.get(c.id) ?? []).join(', '),
        c.marketing_opt_out ? 'Opted out' : 'Opted in',
        c.is_blocked
          ? 'Blocked'
          : c.is_spam
            ? 'Spam'
            : c.is_muted
              ? 'Muted'
              : 'Active',
        c.created_at ? new Date(c.created_at).toISOString() : '',
        ...customFieldList.map(
          (cf) => customValuesMap.get(c.id)?.get(cf.id) ?? '',
        ),
      ]);

      const csv = '\uFEFF' + toCsv(headers, rows);
      const filename = `${filePrefix}-${dateStr}.csv`;

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // XLSX format
    const wb = new ExcelJS.Workbook();
    wb.creator = 'wacrm';
    wb.created = new Date();

    const ws = wb.addWorksheet('Contacts');

    ws.columns = [
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Company', key: 'company', width: 22 },
      { header: 'Date of Birth', key: 'date_of_birth', width: 15 },
      { header: 'Marital Status', key: 'marital_status', width: 16 },
      { header: 'Spouse Name', key: 'spouse_name', width: 20 },
      { header: 'Country', key: 'country', width: 16 },
      { header: 'State', key: 'state', width: 20 },
      { header: 'City', key: 'city', width: 18 },
      { header: 'Locality', key: 'locality', width: 20 },
      { header: 'Street', key: 'street', width: 28 },
      { header: 'Pin Code', key: 'pin_code', width: 14 },
      { header: 'Tags', key: 'tags', width: 24 },
      { header: 'Marketing Consent', key: 'marketing_consent', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Created At', key: 'created_at', width: 20 },
      ...customFieldList.map((cf) => ({
        header: cf.field_name,
        key: `custom_${cf.id}`,
        width: Math.max(16, cf.field_name.length + 4),
      })),
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FF1F2937' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    headerRow.height = 24;

    contacts.forEach((c) => {
      const rowData: Record<string, any> = {
        name: c.name ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
        company: c.company ?? '',
        date_of_birth: c.date_of_birth ?? '',
        marital_status: c.marital_status ?? '',
        spouse_name: c.spouse_name ?? '',
        country: c.country ?? '',
        state: c.state ?? '',
        city: c.city ?? '',
        locality: c.locality ?? '',
        street: c.street ?? '',
        pin_code: c.pin_code ?? '',
        tags: (contactTagsMap.get(c.id) ?? []).join(', '),
        marketing_consent: c.marketing_opt_out ? 'Opted out' : 'Opted in',
        status: c.is_blocked
          ? 'Blocked'
          : c.is_spam
            ? 'Spam'
            : c.is_muted
              ? 'Muted'
              : 'Active',
        created_at: c.created_at ? new Date(c.created_at) : '',
      };
      customFieldList.forEach((cf) => {
        rowData[`custom_${cf.id}`] =
          customValuesMap.get(c.id)?.get(cf.id) ?? '';
      });
      ws.addRow(rowData);
    });

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `${filePrefix}-${dateStr}.xlsx`;

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
