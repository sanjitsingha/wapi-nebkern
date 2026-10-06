import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateOpenRouter } from './openrouter';
import { AiError } from '../types';
import { MAX_OUTPUT_TOKENS } from '../defaults';

const args = {
  apiKey: 'sk-or-test',
  model: 'deepseek/deepseek-r1:free',
  systemPrompt: 'system',
  messages: [{ role: 'user' as const, content: 'hi' }],
  timeoutMs: 5_000,
};

function reply(body: unknown) {
  // A fresh Response per call — a body can only be read once.
  const fetchMock = vi.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateOpenRouter', () => {
  it('names the output limit when a reasoning model runs out before answering', async () => {
    // What a reasoning model sends back when its thinking eats the whole
    // allowance: a 200, an empty answer, and finish_reason "length".
    reply({
      choices: [{ message: { content: '', reasoning: 'Let me think…' }, finish_reason: 'length' }],
    });
    const err = await generateOpenRouter(args).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe('output_limit');
    expect(err.message).toContain('deepseek/deepseek-r1:free');
  });

  it('keeps a plain empty answer as empty_response, with the finish reason', async () => {
    reply({ choices: [{ message: { content: null }, finish_reason: 'stop' }] });
    const err = await generateOpenRouter(args).catch((e) => e);
    expect(err.code).toBe('empty_response');
    expect(err.message).toContain('finish reason: stop');
  });

  it('sends the caller’s output cap, and the chat default without one', async () => {
    const fetchMock = reply({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] });
    await generateOpenRouter({ ...args, maxOutputTokens: 4096 });
    await generateOpenRouter(args);
    const sent = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).max_tokens);
    expect(sent).toEqual([4096, MAX_OUTPUT_TOKENS]);
  });
});
