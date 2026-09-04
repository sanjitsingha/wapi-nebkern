import { describe, expect, it } from 'vitest';

import { WEBHOOK_EVENTS } from './events';
import { allSamples, sampleFor, sampleJson } from './samples';

// A sample that disagrees with what actually arrives is worse than no
// sample: it sends someone off building a Zap against a field that does
// not exist. These cannot verify the field names against the emit call
// sites — nothing can, short of running them — but they do catch an
// event being added or renamed without its sample following.
describe('webhook samples', () => {
  it('covers every event in the catalog', () => {
    const sampled = new Set(allSamples().map((s) => s.type));
    for (const e of WEBHOOK_EVENTS) {
      expect(sampled.has(e.type), `no sample for ${e.type}`).toBe(true);
    }
    expect(sampled.size).toBe(WEBHOOK_EVENTS.length);
  });

  it('wraps each sample in the delivery envelope', () => {
    // The envelope is what a Zap actually receives — a sample of the
    // bare `data` would have people reading `contact_id` at the top
    // level, where it is not.
    for (const e of WEBHOOK_EVENTS) {
      const s = sampleFor(e.type);
      expect(s.event).toBe(e.type);
      expect(s.id).toBeTruthy();
      expect(s.created_at).toBeTruthy();
      expect(s.account_id).toBeTruthy();
      expect(typeof s.data).toBe('object');
    }
  });

  it('gives every sample a non-empty data object', () => {
    // An empty `data` renders as `{}` in the UI and teaches nothing.
    for (const e of WEBHOOK_EVENTS) {
      expect(
        Object.keys(sampleFor(e.type).data).length,
        `${e.type} has empty data`,
      ).toBeGreaterThan(0);
    }
  });

  it('emits valid, readable JSON', () => {
    for (const e of WEBHOOK_EVENTS) {
      const json = sampleJson(e.type);
      expect(() => JSON.parse(json)).not.toThrow();
      // Indented — this is pasted into a Zapier field and read by a
      // person, not machine-parsed.
      expect(json).toContain('\n  ');
    }
  });

  it('uses placeholder ids, never anything that looks real', () => {
    // Guards against a debugging session leaving a live account id or
    // customer phone number in a file the whole product renders.
    const blob = JSON.stringify(allSamples());
    expect(blob).not.toMatch(/\bnebkern\b/i);
    // The sample phone is the documentation number used across the
    // codebase; anything else here would be worth a second look.
    const phones = blob.match(/\b91\d{10}\b/g) ?? [];
    for (const p of phones) expect(p).toBe('919876543210');
  });
});
