import { describe, expect, it } from 'vitest';

import { parseTemplateDraft } from './template-draft';
import { AiError } from './types';
import {
  TEMPLATE_LIMITS,
  validateBody,
  validateButtons,
  validateFooter,
  validateHeader,
  validateSampleValues,
  validateTemplateName,
} from '@/lib/whatsapp/template-validators';

const opts = { prompt: 'Diwali sale for our saree shop', defaultLanguage: 'en_US' };
const parse = (o: unknown) => parseTemplateDraft(JSON.stringify(o), opts);

describe('parseTemplateDraft', () => {
  it('turns a well-formed answer into a draft that passes the submit validators', () => {
    const { draft, notes } = parse({
      name: 'diwali_sale_offer',
      category: 'Marketing',
      language: 'en',
      header: { type: 'text', text: 'Diwali offer for {{1}}' },
      header_sample: 'Priya',
      body: 'Hi {{1}}, our Diwali sale is live! Get {{2}} off every saree until {{3}}. Shop now.',
      body_samples: ['Priya', '20%', '5 November'],
      footer: 'Reply STOP to unsubscribe',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Show me sarees' },
        { type: 'URL', text: 'Visit shop', url: 'https://shop.example.in/diwali' },
      ],
    });

    expect(notes).toEqual([]);
    expect(() => validateTemplateName(draft.name)).not.toThrow();
    expect(validateBody(draft.body_text)).toEqual([1, 2, 3]);
    expect(() => validateFooter(draft.footer_text)).not.toThrow();
    expect(
      validateHeader({ header_type: 'text', header_content: draft.header_content }).variableCount,
    ).toBe(1);
    expect(() => validateButtons(draft.buttons)).not.toThrow();
    expect(() =>
      validateSampleValues(
        {
          name: draft.name,
          category: draft.category,
          language: draft.language,
          body_text: draft.body_text,
          sample_values: { body: draft.body_samples, header: [draft.header_sample] },
        },
        3,
        1,
      ),
    ).not.toThrow();
  });

  it('renumbers gapped and named variables, and moves the samples with them', () => {
    const { draft } = parse({
      body: 'Hi {{name}}, order {{3}} ships on {{5}}. Thanks, {{name}}!',
      body_samples: { name: 'Priya', 3: 'ORD-1', 5: 'Monday' },
    });
    expect(draft.body_text).toBe('Hi {{1}}, order {{2}} ships on {{3}}. Thanks, {{1}}!');
    expect(draft.body_samples).toEqual(['Priya', 'ORD-1', 'Monday']);
    expect(validateBody(draft.body_text)).toEqual([1, 2, 3]);
  });

  it('fills a missing sample rather than leaving it empty', () => {
    const { draft } = parse({ body: 'Hi {{1}}, your order {{2}} is ready.', body_samples: ['Priya'] });
    expect(draft.body_samples).toEqual(['Priya', 'Sample']);
  });

  it('strips what Meta rejects from a text header', () => {
    const { draft } = parse({
      body: 'Hello there, welcome.',
      header: { type: 'text', text: '🎉 *Big* sale\nfor {{2}} and {{3}}' },
    });
    expect(draft.header_content).toBe('Big sale for {{1}} and');
    expect(() =>
      validateHeader({ header_type: 'text', header_content: draft.header_content }),
    ).not.toThrow();
    expect(draft.header_sample).toBe('Sample');
  });

  it('asks for the file when the header is media', () => {
    const { draft, notes } = parse({ body: 'New arrivals are here.', header: { type: 'image' } });
    expect(draft.header_format).toBe('image');
    expect(notes.join(' ')).toMatch(/Attach the header image/);
  });

  it('never invents a link or phone number — it leaves them blank with a note', () => {
    const { draft, notes } = parse({
      body: 'Your table is booked.',
      buttons: [
        { type: 'URL', text: 'Manage booking', url: '' },
        { type: 'PHONE_NUMBER', text: 'Call us', phone_number: 'call our store' },
      ],
    });
    expect(draft.buttons).toEqual([
      { type: 'URL', text: 'Manage booking', url: '' },
      { type: 'PHONE_NUMBER', text: 'Call us', phone_number: '' },
    ]);
    expect(notes).toEqual([
      'Add the link for the “Manage booking” button.',
      'Add the phone number for the “Call us” button.',
    ]);
  });

  it('repairs button order, counts, lengths and URLs', () => {
    const { draft } = parse({
      body: 'Track your order any time.',
      buttons: [
        { type: 'URL', text: 'Track my order right now please', url: 'shop.example.in/track/{{4}}', example: 'ORD-9' },
        { type: 'quick reply', text: 'Yes' },
        { type: 'URL', text: 'Shop', url: 'https://shop.example.in' },
        { type: 'URL', text: 'Third link', url: 'https://shop.example.in/x' },
        { type: 'QUICK_REPLY', text: 'No' },
        { type: 'SMOKE_SIGNAL', text: 'Nope' },
      ],
    });
    expect(draft.buttons).toEqual([
      { type: 'QUICK_REPLY', text: 'Yes' },
      { type: 'QUICK_REPLY', text: 'No' },
      { type: 'URL', text: 'Track my order right now', url: 'https://shop.example.in/track/{{1}}', example: 'ORD-9' },
      { type: 'URL', text: 'Shop', url: 'https://shop.example.in' },
    ]);
    expect(() => validateButtons(draft.buttons)).not.toThrow();
    for (const b of draft.buttons) {
      expect(b.text.length).toBeLessThanOrEqual(TEMPLATE_LIMITS.buttonTextMaxLength);
    }
  });

  it('cleans the name, category, language and footer', () => {
    const { draft } = parse({
      name: 'Diwali Sale — 2026!',
      category: 'UTILITY',
      language: 'english',
      body: 'Hello there, welcome.',
      footer: 'Questions? Reply {{1}} any time, our team will get back to you soon',
    });
    expect(draft.name).toBe('diwali_sale_2026');
    expect(draft.category).toBe('Utility');
    expect(draft.language).toBe('en_US');
    expect(draft.footer_text).not.toMatch(/\{\{/);
    expect(() => validateFooter(draft.footer_text)).not.toThrow();
  });

  it('names the template from the request when the model gives no name', () => {
    expect(parse({ body: 'Hello there.' }).draft.name).toBe('diwali_sale_for_our');
  });

  it('cuts an over-long body to Meta’s limit without leaving half a variable', () => {
    const body = `Hi {{1}}, ${'great offers today. '.repeat(60)}Use code {{2}} now.`;
    const { draft } = parse({ body, body_samples: ['Priya', 'X'] });
    expect(draft.body_text.length).toBeLessThanOrEqual(TEMPLATE_LIMITS.bodyMaxLength);
    expect(validateBody(draft.body_text)).toEqual([1]);
    expect(draft.body_samples).toEqual(['Priya']);
  });

  it('warns when the body starts or ends with a variable', () => {
    expect(parse({ body: '{{1}}, your order is ready.' }).notes.join(' ')).toMatch(/starts or ends/);
    expect(parse({ body: 'Your order is ready, {{1}}.' }).notes.join(' ')).toMatch(/starts or ends/);
    expect(parse({ body: 'Hi {{1}}, your order is ready.' }).notes).toEqual([]);
  });

  it('reads JSON inside a code fence', () => {
    const raw = 'Here you go:\n```json\n{"body":"Hello there.","name":"hello"}\n```';
    expect(parseTemplateDraft(raw, opts).draft.name).toBe('hello');
  });

  it('throws a typed error when there is no object or no body', () => {
    expect(() => parseTemplateDraft('Sorry, I cannot help.', opts)).toThrow(AiError);
    expect(() => parse({ name: 'x' })).toThrow(AiError);
  });
});
