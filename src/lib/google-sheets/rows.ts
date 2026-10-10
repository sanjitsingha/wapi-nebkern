// ============================================================
// What Instant writes to a connected Google Sheet, cell by cell.
//
// Each sheet receives ONE kind of entry (its event type), so each is a
// single clean table: one tab, one header row.
//
// Pure: no Google, no database. The queue drain hands each function the
// event as it was queued plus whatever it looked up (stage names, the
// contact, the agent), and gets back the row in its header's column
// order. The tests pin the shape, because a column that moves breaks
// every customer's formulas and filters that point at it.
// ============================================================

export type SheetEventType = 'contacts' | 'messages' | 'assignments' | 'deals' | 'campaigns';

/** Instant's customers are in India; the column headers say so. */
export const SHEET_TIMEZONE = 'Asia/Kolkata';
const TZ_LABEL = 'IST';

/**
 * The entry types a sheet can subscribe to, in the order the picker
 * shows them. `webhookEvent` is the app event that produces the entry;
 * campaign results have none — they are swept a day after sending.
 */
export const SHEET_EVENT_TYPES: {
  type: SheetEventType;
  label: string;
  description: string;
  /** The spreadsheet's single tab. */
  tab: string;
  webhookEvent: string | null;
}[] = [
  {
    type: 'contacts',
    label: 'New contacts',
    description: 'A row for every contact added, from WhatsApp, the API or by hand.',
    tab: 'Contacts',
    webhookEvent: 'contact.created',
  },
  {
    type: 'messages',
    label: 'Incoming messages',
    description: 'A row for every WhatsApp message a customer sends you.',
    tab: 'Messages',
    webhookEvent: 'message.received',
  },
  {
    type: 'assignments',
    label: 'Conversation assignments',
    description: 'A row each time a conversation is assigned to an agent.',
    tab: 'Assignments',
    webhookEvent: 'conversation.assigned',
  },
  {
    type: 'deals',
    label: 'Deal stage changes',
    description: 'A row each time a deal moves to another pipeline stage.',
    tab: 'Deals',
    webhookEvent: 'deal.stage_changed',
  },
  {
    type: 'campaigns',
    label: 'Campaign results',
    description:
      'A row per recipient — delivered, read, replied or failed — a day after a campaign finishes sending.',
    tab: 'Campaign results',
    webhookEvent: null,
  },
];

export function isSheetEventType(value: unknown): value is SheetEventType {
  return SHEET_EVENT_TYPES.some((e) => e.type === value);
}

export function eventMeta(type: SheetEventType) {
  return SHEET_EVENT_TYPES.find((e) => e.type === type)!;
}

/** The sheet event type an app event feeds, if any. */
export function sheetTypeForWebhookEvent(event: string): SheetEventType | null {
  return SHEET_EVENT_TYPES.find((e) => e.webhookEvent === event)?.type ?? null;
}

/**
 * Header row per entry type. Append-only by design: new columns go on
 * the end, never in the middle, so a customer's existing formulas keep
 * pointing at the same data.
 */
export const TAB_HEADERS: Record<SheetEventType, string[]> = {
  contacts: [`Added (${TZ_LABEL})`, 'Name', 'Phone', 'Email', 'Tags', 'Contact ID'],
  messages: [
    `Received (${TZ_LABEL})`,
    'Contact',
    'Phone',
    'Type',
    'Message',
    'Conversation ID',
    'Message ID',
  ],
  assignments: [
    `Assigned (${TZ_LABEL})`,
    'Contact',
    'Phone',
    'Assigned to',
    'Agent email',
    'Conversation ID',
  ],
  deals: [
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
  campaigns: [
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

export interface MessageRowInput {
  receivedAt: string | null;
  contactName: string | null;
  phone: string | null;
  /** text, image, document, … */
  type: string | null;
  text: string | null;
  conversationId: string | null;
  messageId: string | null;
}

/** Longest message text written to a cell; Sheets caps a cell at 50,000. */
const MAX_MESSAGE_CHARS = 5000;

export function messageRow(m: MessageRowInput): string[] {
  const text = m.text ?? '';
  return [
    sheetTime(m.receivedAt),
    literal(m.contactName),
    literal(m.phone),
    m.type ?? '',
    literal(text.length > MAX_MESSAGE_CHARS ? `${text.slice(0, MAX_MESSAGE_CHARS)}…` : text),
    m.conversationId ?? '',
    m.messageId ?? '',
  ];
}

export interface AssignmentRowInput {
  assignedAt: string | null;
  contactName: string | null;
  phone: string | null;
  agentName: string | null;
  agentEmail: string | null;
  conversationId: string | null;
}

export function assignmentRow(a: AssignmentRowInput): string[] {
  return [
    sheetTime(a.assignedAt),
    literal(a.contactName),
    literal(a.phone),
    literal(a.agentName),
    a.agentEmail ?? '',
    a.conversationId ?? '',
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

/**
 * A clearly-labelled row for "Send a test row": the sheet's own columns,
 * so it lands where real entries will and shows the shape they take.
 */
export function sampleRow(type: SheetEventType, now: Date = new Date()): string[] {
  const at = now.toISOString();
  const label = 'Test row from Instant';
  switch (type) {
    case 'contacts':
      return contactRow({ createdAt: at, contactId: 'test', name: label, phone: null, email: null, tags: [] });
    case 'messages':
      return messageRow({
        receivedAt: at,
        contactName: label,
        phone: null,
        type: 'text',
        text: 'If you can read this, Instant can write to this sheet.',
        conversationId: 'test',
        messageId: 'test',
      });
    case 'assignments':
      return assignmentRow({
        assignedAt: at,
        contactName: label,
        phone: null,
        agentName: null,
        agentEmail: null,
        conversationId: 'test',
      });
    case 'deals':
      return dealRow({
        changedAt: at,
        dealId: 'test',
        title: label,
        value: null,
        currency: null,
        pipeline: null,
        fromStage: null,
        toStage: null,
        contactName: null,
        contactPhone: null,
      });
    case 'campaigns':
      return campaignRow({
        campaign: label,
        template: '',
        sentAt: at,
        contactName: null,
        phone: null,
        status: 'test',
        deliveredAt: null,
        readAt: null,
        repliedAt: null,
        error: null,
      });
  }
}
