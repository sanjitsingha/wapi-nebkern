// ============================================================
// What Instant writes to a connected Google Sheet, cell by cell.
//
// Pure: no Google, no database. The queue drain hands each function the
// event as it was queued plus whatever it looked up (stage names, the
// contact), and gets back the row in its tab's column order. The tests
// pin the shape, because a column that moves breaks every customer's
// formulas and filters that point at it.
// ============================================================

export type SheetTab = 'Contacts' | 'Deals' | 'Campaigns';

/** Instant's customers are in India; the column headers say so. */
export const SHEET_TIMEZONE = 'Asia/Kolkata';
const TZ_LABEL = 'IST';

/**
 * Header row per tab. Append-only by design: new columns go on the end,
 * never in the middle, so a customer's existing formulas keep pointing
 * at the same data.
 */
export const TAB_HEADERS: Record<SheetTab, string[]> = {
  Contacts: [`Added (${TZ_LABEL})`, 'Name', 'Phone', 'Email', 'Tags', 'Contact ID'],
  Deals: [
    `Changed (${TZ_LABEL})`,
    'Deal',
    'Value',
    'Currency',
    'Pipeline',
    'From stage',
    'To stage',
    'Contact',
    'Contact phone',
    'Deal ID',
  ],
  Campaigns: [
    'Campaign',
    'Template',
    `Sent (${TZ_LABEL})`,
    'Contact',
    'Phone',
    'Status',
    `Delivered (${TZ_LABEL})`,
    `Read (${TZ_LABEL})`,
    `Replied (${TZ_LABEL})`,
    'Error',
  ],
};

export const SHEET_TABS = Object.keys(TAB_HEADERS) as SheetTab[];

/**
 * A timestamp as "2026-10-10 16:41:05" in India time — the shape Google
 * Sheets reads as a real date-time under USER_ENTERED, so it sorts and
 * filters as one. Empty for a missing or unreadable value.
 */
export function sheetTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: SHEET_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  // en-GB can render midnight as "24"; a sheet wants "00".
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}`;
}

/**
 * A cell Sheets will not try to interpret. Phone numbers are the case
 * that matters: "+919876543210" under USER_ENTERED becomes a number and
 * loses its plus, and a leading "=" would be read as a formula. The
 * apostrophe makes it literal text and is not shown in the cell.
 */
export function literal(value: string | null | undefined): string {
  if (!value) return '';
  return /^[=+\-@]/.test(value) || /^\d/.test(value) ? `'${value}` : value;
}

export interface ContactRowInput {
  createdAt: string | null;
  contactId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
}

export function contactRow(c: ContactRowInput): string[] {
  return [
    sheetTime(c.createdAt),
    literal(c.name),
    literal(c.phone),
    c.email ?? '',
    c.tags.join(', '),
    c.contactId,
  ];
}

export interface DealRowInput {
  changedAt: string;
  dealId: string;
  title: string | null;
  value: number | string | null;
  currency: string | null;
  pipeline: string | null;
  fromStage: string | null;
  toStage: string | null;
  contactName: string | null;
  contactPhone: string | null;
}

export function dealRow(d: DealRowInput): string[] {
  return [
    sheetTime(d.changedAt),
    literal(d.title),
    d.value === null || d.value === undefined ? '' : String(d.value),
    d.currency ?? '',
    literal(d.pipeline),
    literal(d.fromStage),
    literal(d.toStage),
    literal(d.contactName),
    literal(d.contactPhone),
    d.dealId,
  ];
}

export interface CampaignRowInput {
  campaign: string;
  template: string;
  sentAt: string | null;
  contactName: string | null;
  phone: string | null;
  status: string;
  deliveredAt: string | null;
  readAt: string | null;
  repliedAt: string | null;
  error: string | null;
}

export function campaignRow(r: CampaignRowInput): string[] {
  return [
    literal(r.campaign),
    r.template,
    sheetTime(r.sentAt),
    literal(r.contactName),
    literal(r.phone),
    r.status,
    sheetTime(r.deliveredAt),
    sheetTime(r.readAt),
    sheetTime(r.repliedAt),
    literal(r.error),
  ];
}
