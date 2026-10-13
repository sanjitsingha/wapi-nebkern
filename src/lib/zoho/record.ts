// ============================================================
// A Zoho Lead or Contact, reduced to what an agent needs in the inbox.
//
// Pure functions over the record Zoho returns, so the field choices are
// testable without Zoho. Leads and Contacts name the same idea
// differently (Company vs the Account_Name lookup, Designation vs
// Title, City vs Mailing_City); both come out the same shape here.
// ============================================================

export type ZohoRecordRow = Record<string, unknown>;

/** A field as text: strings and numbers as they are, lookups by their
 *  name, and Zoho's "-None-" picklist placeholder as nothing. */
function text(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim();
    return t && t !== '-None-' ? t : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value && typeof value === 'object' && !Array.isArray(value) && 'name' in value) {
    return text((value as { name: unknown }).name);
  }
  return null;
}

export interface ZohoRecordView {
  name: string | null;
  owner: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  /** Lead: Company. Contact: the Account it belongs to. */
  company: string | null;
  /** Lead: Designation. Contact: Title. */
  title: string | null;
  /** Leads only. */
  status: string | null;
  source: string | null;
  city: string | null;
  created: string | null;
  modified: string | null;
  lastActivity: string | null;
}

export function pickZohoRecord(row: ZohoRecordRow, zohoModule: 'Leads' | 'Contacts'): ZohoRecordView {
  const lead = zohoModule === 'Leads';
  const name =
    text(row.Full_Name) ??
    ([text(row.First_Name), text(row.Last_Name)].filter(Boolean).join(' ') || null);
  return {
    name,
    owner: text(row.Owner),
    email: text(row.Email),
    mobile: text(row.Mobile),
    phone: text(row.Phone),
    company: lead ? text(row.Company) : text(row.Account_Name),
    title: lead ? text(row.Designation) : text(row.Title),
    status: lead ? text(row.Lead_Status) : null,
    source: text(row.Lead_Source),
    city: lead ? text(row.City) : text(row.Mailing_City),
    created: text(row.Created_Time),
    modified: text(row.Modified_Time),
    lastActivity: text(row.Last_Activity_Time),
  };
}

export interface ZohoDealView {
  id: string;
  name: string | null;
  stage: string | null;
  amount: number | null;
  /** The org's currency symbol, when Zoho sends it with the record. */
  currency: string | null;
  closingDate: string | null;
  url?: string | null;
}

export function pickZohoDeals(rows: ZohoRecordRow[], max = 5): ZohoDealView[] {
  const deals: ZohoDealView[] = [];
  for (const row of rows) {
    const id = text(row.id);
    if (!id) continue;
    const raw = row.Amount;
    const amount = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    deals.push({
      id,
      name: text(row.Deal_Name),
      stage: text(row.Stage),
      amount: Number.isFinite(amount) ? amount : null,
      currency: text(row.$currency_symbol),
      closingDate: text(row.Closing_Date),
    });
    if (deals.length >= max) break;
  }
  return deals;
}
