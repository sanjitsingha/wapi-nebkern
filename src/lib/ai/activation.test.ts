import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./generate', () => ({ generateText: vi.fn() }));

import { generateText } from './generate';
import { isNo, shouldActivate } from './activation';
import type { AiConfig } from './types';

const generate = vi.mocked(generateText);

const config: AiConfig = {
  provider: 'openai',
  model: 'gpt-test',
  apiKey: 'key',
  systemPrompt: null,
  isActive: true,
  autoReplyEnabled: true,
  autoReplyMaxPerConversation: 3,
  embeddingsApiKey: null,
};

const messages = Array.from({ length: 8 }, (_, i) => ({
  role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
  content: `turn ${i}`,
}));

beforeEach(() => {
  generate.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('shouldActivate', () => {
  it('stays quiet on a clear NO', async () => {
    generate.mockResolvedValueOnce('NO');
    expect(await shouldActivate({ config, rules: 'Only questions.', messages })).toBe(false);
  });

  it('replies on YES', async () => {
    generate.mockResolvedValueOnce('Yes.');
    expect(await shouldActivate({ config, rules: 'Only questions.', messages })).toBe(true);
  });

  it('fails open: an empty or unclear answer means reply', async () => {
    generate.mockResolvedValueOnce('');
    expect(await shouldActivate({ config, rules: 'r', messages })).toBe(true);
    generate.mockResolvedValueOnce('Maybe');
    expect(await shouldActivate({ config, rules: 'r', messages })).toBe(true);
  });

  it('fails open when the provider errors', async () => {
    generate.mockRejectedValueOnce(new Error('timeout'));
    expect(await shouldActivate({ config, rules: 'r', messages })).toBe(true);
  });

  it('sends the rules plus the YES/NO instruction, and only recent turns', async () => {
    generate.mockResolvedValueOnce('YES');
    await shouldActivate({ config, rules: '  Only questions.  ', messages });
    const args = generate.mock.calls[0][0];
    expect(args.systemPrompt.startsWith('Only questions.\n\n')).toBe(true);
    expect(args.systemPrompt).toMatch(/exactly one word: YES .* or NO/);
    expect(args.messages).toEqual(messages.slice(-6));
  });
});

describe('isNo', () => {
  it('reads NO through case and punctuation', () => {
    expect(isNo('NO')).toBe(true);
    expect(isNo('no.')).toBe(true);
    expect(isNo('**No**')).toBe(true);
    expect(isNo('Not sure')).toBe(false);
    expect(isNo('YES')).toBe(false);
  });
});
