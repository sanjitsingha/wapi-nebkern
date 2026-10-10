import { describe, expect, it } from 'vitest';

import { fetchableModule } from './enrich';
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
