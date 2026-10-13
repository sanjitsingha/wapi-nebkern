import { describe, expect, it } from 'vitest';

import { dealContactId, fetchableModule, mergeEnriched } from './enrich';
import { normalizeZohoPayload } from './payload';
import { ZOHO_SCOPES } from './client';

// What a Workflow Rule calls its module is free text — whatever the
// person building it typed. Asking Zoho for a module we hold no scope
// for returns 403 OAUTH_SCOPE_MISMATCH, which would fill the event log
// with failures for events that are working perfectly well.
describe('fetchableModule', () => {
  it('accepts the modules the scopes actually cover', () => {
    expect(fetchableModule('Leads')).toBe('Leads');
    expect(fetchableModule('Contacts')).toBe('Contacts');
    expect(fetchableModule('Deals')).toBe('Deals');
  });

  it('is case- and number-insensitive, because rule authors are', () => {
    expect(fetchableModule('lead')).toBe('Leads');
    expect(fetchableModule('LEADS')).toBe('Leads');
    expect(fetchableModule('  Contact  ')).toBe('Contacts');
  });

  it('still answers to Potentials, which is what Deals used to be', () => {
    // Zoho renamed it years ago and accepts both; an org carrying an
    // old rule sends the old name.
    expect(fetchableModule('Potentials')).toBe('Deals');
    expect(fetchableModule('potential')).toBe('Deals');
  });

  it('refuses modules no scope covers', () => {
    // Each of these would 403. Tasks, Calls and Campaigns are real Zoho
    // modules we deliberately do not ask for; the last is a custom one.
    for (const m of ['Tasks', 'Calls', 'Campaigns', 'Accounts', 'My_Custom']) {
      expect(fetchableModule(m), `${m} should not be fetched`).toBeNull();
    }
  });

  it('handles the absent case', () => {
    expect(fetchableModule(null)).toBeNull();
    expect(fetchableModule('')).toBeNull();
    expect(fetchableModule('   ')).toBeNull();
  });

  it('only names modules that ZOHO_SCOPES grants read on', () => {
    // The guard that matters: if someone adds a module here without
    // adding its scope, every event for it starts failing at Zoho
    // rather than at code review.
    const fetched = ['Leads', 'Contacts', 'Deals']
      .map((m) => fetchableModule(m))
      .filter((m): m is string => m !== null);

    for (const apiName of fetched) {
      const resource = apiName.toLowerCase();
      const granted = ZOHO_SCOPES.some(
        (s) =>
          s === `ZohoCRM.modules.${resource}.ALL` ||
          s === `ZohoCRM.modules.${resource}.READ`,
      );
      expect(granted, `${apiName} is fetched but has no read scope`).toBe(true);
    }
  });
});

// Every deal event arrives now. A Deal carries no phone, so its person
// is read through Contact_Name — and must not be named after the deal.
describe('deal enrichment', () => {
  const event = normalizeZohoPayload({ id: '77', module: 'Deals', event_type: 'deal.updated' });
  const deal = normalizeZohoPayload({
    id: '77',
    Deal_Name: 'Website redesign',
    Stage: 'Negotiation',
    Contact_Name: { id: '55', name: 'Maya Sen' },
  });
  const person = normalizeZohoPayload({
    id: '55',
    First_Name: 'Maya',
    Last_Name: 'Sen',
    Mobile: '+919876543210',
    Email: 'maya@example.com',
    Stage: 'person-field',
  });

  it('finds the person on a deal', () => {
    expect(dealContactId({ Contact_Name: { id: '55', name: 'Maya Sen' } })).toBe('55');
    expect(dealContactId({ Contact_Name: { id: 55 } })).toBe('55');
    expect(dealContactId({ Contact_Name: null })).toBeNull();
    expect(dealContactId({})).toBeNull();
  });

  it('takes phone and email from the person, never the deal name as theirs', () => {
    const merged = mergeEnriched(event, deal, person, true);
    expect(merged.phone).toBe(person.phone);
    expect(merged.phone).toBeTruthy();
    expect(merged.email).toBe('maya@example.com');
    expect(merged.name).not.toBe('Website redesign');
  });

  it('keeps the deal’s fields on top in the vars', () => {
    const merged = mergeEnriched(event, deal, person, true);
    expect(merged.vars.stage).toBe('Negotiation');
    expect(merged.vars.deal_name).toBe('Website redesign');
    expect(merged.vars.first_name).toBe('Maya');
  });

  it('leaves lead and contact events as they were', () => {
    const lead = normalizeZohoPayload({ id: '9', Last_Name: 'Rao', Mobile: '+919000000001' });
    const merged = mergeEnriched(
      normalizeZohoPayload({ id: '9', module: 'Leads' }),
      lead,
      null,
      false,
    );
    expect(merged.phone).toBe(lead.phone);
    expect(merged.phone).toBeTruthy();
    expect(merged.name).toBe('Rao');
  });
});
