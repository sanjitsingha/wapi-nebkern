import { describe, expect, it } from 'vitest';

import { capZohoTags } from '@/lib/zoho/push';
import { tagOptionValue, tagsPropertyValue } from '@/lib/hubspot/push';
import { normaliseTags, tagDiff } from './tags';

describe('normaliseTags', () => {
  it('trims, keeps one of each ignoring case, and sorts', () => {
    expect(normaliseTags([' VIP ', 'vip', 'Lead', '', null])).toEqual(['Lead', 'VIP']);
  });
});

describe('tagDiff', () => {
  it('adds everything the first time', () => {
    expect(tagDiff(['VIP', 'Lead'], null)).toEqual({ add: ['Lead', 'VIP'], remove: [], changed: true });
  });

  it('removes only what was synced before and is gone now', () => {
    expect(tagDiff(['Lead'], ['Lead', 'VIP'])).toEqual({ add: [], remove: ['VIP'], changed: true });
  });

  it('sees no change in case alone', () => {
    expect(tagDiff(['vip'], ['VIP']).changed).toBe(false);
  });
});

describe('Zoho tag limits', () => {
  it('cuts names to 25 characters and keeps ten', () => {
    const many = Array.from({ length: 12 }, (_, i) => `Tag ${String(i).padStart(2, '0')}`);
    expect(capZohoTags(many)).toHaveLength(10);
    expect(capZohoTags(['A very long tag name that goes on and on'])).toEqual(['A very long tag name that']);
  });
});

describe('HubSpot tag field', () => {
  it('joins tags with semicolons, which a tag name cannot contain', () => {
    expect(tagOptionValue('A;B')).toBe('A,B');
    expect(tagsPropertyValue(['Lead', 'VIP'])).toBe('Lead;VIP');
    expect(tagsPropertyValue([])).toBe('');
  });
});
