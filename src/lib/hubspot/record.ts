// ============================================================
// A HubSpot contact and its deals, reduced to what the inbox panel's
// Integrations tab shows. Pure, so it is tested on its own.
// ============================================================

const LIFECYCLE_LABELS: Record<string, string> = {
  subscriber: 'Subscriber',
  lead: 'Lead',
  marketingqualifiedlead: 'Marketing qualified lead',
  salesqualifiedlead: 'Sales qualified lead',
  opportunity: 'Opportunity',
  customer: 'Customer',
  evangelist: 'Evangelist',
  other: 'Other',
};

/** "IN_PROGRESS" → "In progress"; HubSpot's enum values, readable. */
export function humanise(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (LIFECYCLE_LABELS[v]) return LIFECYCLE_LABELS[v];
  const words = v.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type Props = Record<string, string | null | undefined>;

const clean = (v: string | null | undefined) => (v ?? '').trim() || null;

export interface HubSpotContactView {
  name: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  lifecycle: string | null;
  leadStatus: string | null;
  city: string | null;
  created: string | null;
  modified: string | null;
  lastActivity: string | null;
}

export const RECORD_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'mobilephone',
  'phone',
  'company',
  'jobtitle',
  'lifecyclestage',
  'hs_lead_status',
  'city',
  'createdate',
  'lastmodifieddate',
  'notes_last_updated',
  'hubspot_owner_id',
] as const;

export function pickHubSpotContact(p: Props): HubSpotContactView {
  const name = [clean(p.firstname), clean(p.lastname)].filter(Boolean).join(' ');
  return {
    name: name || clean(p.email),
    email: clean(p.email),
    mobile: clean(p.mobilephone),
    phone: clean(p.phone),
    company: clean(p.company),
    title: clean(p.jobtitle),
    lifecycle: humanise(p.lifecyclestage),
    leadStatus: humanise(p.hs_lead_status),
    city: clean(p.city),
    created: clean(p.createdate),
    modified: clean(p.lastmodifieddate),
    lastActivity: clean(p.notes_last_updated),
  };
}

export interface HubSpotDealView {
  id: string;
  name: string | null;
  stage: string | null;
  amount: number | null;
  currency: string | null;
  closingDate: string | null;
}

/** Newest-closing first, at most `limit`. `stageLabels` maps stage ids
 *  to names; an unknown id is shown as-is rather than hidden. */
export function pickHubSpotDeals(
  deals: { id: string; properties?: Props }[],
  stageLabels: Map<string, string>,
  limit = 5,
): HubSpotDealView[] {
  return deals
    .map((d) => {
      const p = d.properties ?? {};
      const amount = Number(p.amount);
      const stageId = clean(p.dealstage);
      return {
        id: String(d.id),
        name: clean(p.dealname),
        stage: stageId ? (stageLabels.get(stageId) ?? stageId) : null,
        amount: p.amount !== null && p.amount !== undefined && p.amount !== '' && Number.isFinite(amount) ? amount : null,
        currency: clean(p.deal_currency_code),
        closingDate: clean(p.closedate),
      };
    })
    .sort((a, b) => (b.closingDate ?? '').localeCompare(a.closingDate ?? ''))
    .slice(0, limit);
}
