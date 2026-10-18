import { describe, expect, it } from 'vitest';

import {
  cleanOptions,
  customValueProblems,
  dropdownOptions,
  fieldTypeOf,
  valueProblem,
} from './custom-field-types';

const field = (over: Partial<{ field_type: string; field_options: unknown; is_required: boolean }>) => ({
  id: 'f1',
  field_name: 'Lead source',
  field_type: 'text',
  ...over,
});

describe('fieldTypeOf', () => {
  it('falls back to text for anything unknown', () => {
    expect(fieldTypeOf('number')).toBe('number');
    expect(fieldTypeOf('colour')).toBe('text');
    expect(fieldTypeOf(null)).toBe('text');
  });
});

describe('dropdown options', () => {
  it('reads the options array and ignores anything else', () => {
    expect(dropdownOptions({ options: ['Ads', 3, 'Referral'] })).toEqual(['Ads', 'Referral']);
    expect(dropdownOptions(null)).toEqual([]);
  });

  it('trims, drops blanks and repeats', () => {
    expect(cleanOptions([' Ads ', '', 'ads', 'Referral'])).toEqual(['Ads', 'Referral']);
  });
});

describe('valueProblem', () => {
  it('accepts numbers and refuses words in a number field', () => {
    expect(valueProblem(field({ field_type: 'number' }), '42.5')).toBeNull();
    expect(valueProblem(field({ field_type: 'number' }), 'forty')).toMatch(/number/);
  });

  it('accepts real dates only', () => {
    expect(valueProblem(field({ field_type: 'date' }), '2026-10-18')).toBeNull();
    expect(valueProblem(field({ field_type: 'date' }), '2026-02-30')).toMatch(/date/);
  });

  it('accepts only a listed option in a dropdown', () => {
    const f = field({ field_type: 'dropdown', field_options: { options: ['Ads', 'Referral'] } });
    expect(valueProblem(f, 'Ads')).toBeNull();
    expect(valueProblem(f, 'Walk-in')).toMatch(/options/);
  });

  it('lets an empty value through — the mandatory check handles that', () => {
    expect(valueProblem(field({ field_type: 'number' }), '  ')).toBeNull();
  });
});

describe('customValueProblems', () => {
  it('names mandatory fields left empty', () => {
    const fields = [field({ is_required: true }), { ...field({}), id: 'f2', field_name: 'City' }];
    expect(customValueProblems(fields, { f2: 'Pune' })).toEqual(['Fill in Lead source']);
  });

  it('is empty when everything fits', () => {
    expect(customValueProblems([field({ is_required: true })], { f1: 'Ads' })).toEqual([]);
  });
});
