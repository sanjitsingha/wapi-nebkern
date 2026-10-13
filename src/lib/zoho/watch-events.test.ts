import { describe, expect, it } from 'vitest';

import { zohoTriggerMatches } from './watch-events';

// Every Zoho event is watched now, edits included. Which of them run a
// "Zoho CRM Event" automation decides whether a customer gets one
// WhatsApp message or one per field change — so this is pinned down.
describe('zohoTriggerMatches', () => {
  it('runs an automation with nothing picked on new leads and contacts only', () => {
    expect(zohoTriggerMatches(undefined, 'lead.created')).toBe(true);
    expect(zohoTriggerMatches([], 'contact.created')).toBe(true);
    expect(zohoTriggerMatches([], 'lead.updated')).toBe(false);
    expect(zohoTriggerMatches([], 'contact.updated')).toBe(false);
    expect(zohoTriggerMatches([], 'deal.created')).toBe(false);
    expect(zohoTriggerMatches([], 'deal.updated')).toBe(false);
    expect(zohoTriggerMatches({}, 'deal.deleted')).toBe(false);
  });

  it('still runs unfiltered automations on Workflow Rule events', () => {
    // A rule sends its own event name, or none at all.
    expect(zohoTriggerMatches([], 'invoice_overdue')).toBe(true);
    expect(zohoTriggerMatches([], '')).toBe(true);
    expect(zohoTriggerMatches(undefined, undefined)).toBe(true);
  });

  it('runs on exactly what was picked, when something was', () => {
    expect(zohoTriggerMatches(['deal.updated'], 'deal.updated')).toBe(true);
    expect(zohoTriggerMatches(['deal.updated'], 'lead.created')).toBe(false);
    expect(zohoTriggerMatches(['lead.updated'], 'invoice_overdue')).toBe(false);
  });
});
