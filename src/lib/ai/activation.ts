import { generateText } from './generate';
import type { AiConfig, ChatMessage } from './types';

/**
 * Maya's activation rules: before she writes a reply, one short yes/no
 * call asks whether the customer's latest message needs one at all.
 *
 * The rules are the account's own prompt (Maya → Configuration; the
 * suggested default is in reply-settings.ts). This module only adds
 * the instruction to answer YES or NO, and reads the answer.
 */

const ANSWER_INSTRUCTION =
  "Answer with exactly one word: YES if the AI agent should reply to the customer's latest message, or NO if it should stay quiet.";

/** Recent turns the check sees — enough to tell "ok" from "ok, and the price?". */
const CONTEXT_TURNS = 6;

const ACTIVATION_TIMEOUT_MS = 15_000;

/**
 * Whether Maya should answer. Fails open: an error, a timeout or an
 * answer that isn't clearly NO all mean yes — a broken check must never
 * leave a customer silently unanswered.
 */
export async function shouldActivate(args: {
  config: AiConfig;
  rules: string;
  messages: ChatMessage[];
}): Promise<boolean> {
  const { config, rules, messages } = args;
  try {
    const raw = await generateText({
      config,
      systemPrompt: `${rules.trim()}\n\n${ANSWER_INSTRUCTION}`,
      messages: messages.slice(-CONTEXT_TURNS),
      // Room for a reasoning model to think before its one word; an
      // empty answer reads as yes anyway.
      maxOutputTokens: 64,
      timeoutMs: ACTIVATION_TIMEOUT_MS,
    });
    return !isNo(raw);
  } catch (err) {
    console.warn(
      '[ai activation] check failed — replying anyway:',
      err instanceof Error ? err.message : err,
    );
    return true;
  }
}

/** A clear NO, ignoring punctuation and case: "No", "NO.", "**no**". */
export function isNo(raw: string): boolean {
  return /^\W*no\b/i.test(raw.trim());
}
