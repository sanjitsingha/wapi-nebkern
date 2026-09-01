// ============================================================
// Turn a Zoho Workflow Rule payload into something the automation
// engine can use.
//
// The hard part is that there IS no fixed shape. A Workflow Rule's
// webhook sends whatever fields the person configuring it ticked, under
// whatever names their Zoho org uses — including custom fields, which
// arrive with API names like `Order_Value__c`. Two customers wiring up
// "deal won" will send different payloads.
//
// So this does not parse a schema. It looks for a phone under any of
// the names Zoho plausibly uses, and passes everything else through as
// {{vars.*}} for the automation to reference by name. What the user
// sees in the builder is therefore whatever they actually sent.
// ============================================================

import { toIndianE164, isValidE164 } from '@/lib/whatsapp/phone-utils';

/** Field names Zoho uses for a phone, in the order we prefer them.
 *
 *  `Phone` before `Mobile` is deliberate for CRM records — a Zoho
 *  Contact's `Phone` is usually the one a business answers, and
 *  `Mobile` is often blank. WhatsApp needs a mobile, so both are tried;
 *  this is only the tie-break when a record has both. */
const PHONE_KEYS = [
  'Mobile',
  'Phone',
  'phone',
  'mobile',
  'Phone_Number',
  'Mobile_Number',
  'WhatsApp',
  'WhatsApp_Number',
  'Contact_Number',
  'Secondary_Phone',
] as const;

const NAME_KEYS = [
  'Full_Name',
  'Contact_Name',
  'Account_Name',
  'Deal_Name',
  'Name',
  'name',
  'Last_Name',
  'First_Name',
] as const;

const EMAIL_KEYS = ['Email', 'email', 'Secondary_Email'] as const;

export interface ZohoNormalized {
  /** E.164, or null when the payload carried nothing usable. */
  phone: string | null;
  name: string | null;
  email: string | null;
  /** What the Workflow Rule called this event. */
  eventType: string | null;
  module: string | null;
  recordId: string | null;
  /** Flattened scalars from the payload, for {{vars.*}}. */
  vars: Record<string, string>;
}

/**
 * Read a value that may be a scalar, or Zoho's `{ id, name }` lookup
 * shape, or an array of either.
 *
 * A Deal's `Contact_Name` is an object, not a string — treating it as
 * one is how you end up sending "[object Object]" to a customer.
 */
function readScalar(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    // Take the first usable entry — a multi-select arrives as an array
    // and the first choice is the useful one far more often than a
    // comma-joined blob is.
    for (const item of value) {
      const s = readScalar(item);
      if (s) return s;
    }
    return null;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    // Zoho lookup fields: { id, name }. The name is what a human wants.
    for (const key of ['name', 'Name', 'full_name', 'display_value']) {
      const s = readScalar(o[key]);
      if (s) return s;
    }
    return null;
  }
  return null;
}

/** First present value among `keys`, case-insensitively. */
function pick(
  source: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const s = readScalar(source[key]);
    if (s) return s;
  }
  // Fall back to a case-insensitive sweep — orgs rename fields, and
  // `PHONE` or `phone_number` should still be found.
  const lowered = new Map(
    Object.keys(source).map((k) => [k.toLowerCase(), k] as const),
  );
  for (const key of keys) {
    const actual = lowered.get(key.toLowerCase());
    if (actual) {
      const s = readScalar(source[actual]);
      if (s) return s;
    }
  }
  return null;
}

/** How many fields to expose as vars. A Zoho record can carry a
 *  hundred; the builder's picker and the log row both become unusable
 *  well before that, and nobody templates against field ninety. */
const MAX_VARS = 40;

export function normalizeZohoPayload(raw: unknown): ZohoNormalized {
  const body = (raw ?? {}) as Record<string, unknown>;

  // Zoho Workflow Rules can send the record at the top level, or nested
  // under `data` / a module key, depending on how the rule was built.
  // Try the common wrappers before giving up on the top level.
  const record =
    (firstObject(body.data) as Record<string, unknown> | null) ??
    (isPlainObject(body.record) ? (body.record as Record<string, unknown>) : null) ??
    body;

  const rawPhone = pick(record, PHONE_KEYS) ?? pick(body, PHONE_KEYS);
  const phone = rawPhone ? toIndianE164(rawPhone) : null;

  const vars: Record<string, string> = {};
  let count = 0;
  for (const [key, value] of Object.entries(record)) {
    if (count >= MAX_VARS) break;
    const s = readScalar(value);
    if (s === null) continue;
    // Normalise the key so a template can be written once: Zoho's
    // `Deal_Name` and a hand-set `deal name` both become `deal_name`.
    const varKey = key
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w]/g, '')
      .toLowerCase();
    if (!varKey || vars[varKey] !== undefined) continue;
    vars[varKey] = s;
    count += 1;
  }

  const eventType =
    readScalar(body.event_type) ??
    readScalar(body.event) ??
    readScalar(record.event_type) ??
    null;

  if (eventType) vars.event = eventType;

  return {
    phone: phone && isValidE164(phone) ? phone : null,
    name: pick(record, NAME_KEYS),
    email: pick(record, EMAIL_KEYS),
    eventType,
    module:
      readScalar(body.module) ??
      readScalar(record.module) ??
      readScalar(body.Module) ??
      null,
    recordId:
      readScalar(record.id) ?? readScalar(body.id) ?? readScalar(body.record_id),
    vars,
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `data` is usually an array of one record; sometimes it is the
 *  record itself. */
function firstObject(v: unknown): Record<string, unknown> | null {
  if (Array.isArray(v)) {
    const first = v.find(isPlainObject);
    return first ?? null;
  }
  return isPlainObject(v) ? v : null;
}
