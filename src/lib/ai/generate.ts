import {
  AiError,
  type AiConfig,
  type ChatMessage,
  type GenerateResult,
} from './types';
import { HANDOFF_SENTINEL, aiRequestTimeoutMs } from './defaults';
import { generateOpenAi } from './providers/openai';
import { generateAnthropic } from './providers/anthropic';
import { generateOpenRouter } from './providers/openrouter';

export interface GenerateArgs {
  config: AiConfig;
  /** Fully-built system prompt (see `buildSystemPrompt`). */
  systemPrompt: string;
  /** Recent conversation turns, oldest first. */
  messages: ChatMessage[];
}

/**
 * Generate the next reply from the account's configured provider.
 * Dispatches to the right adapter, then parses the handoff sentinel out
 * of the raw text. Throws `AiError` on any provider/network failure.
 */
export async function generateReply(
  args: GenerateArgs
): Promise<GenerateResult> {
  const { config, systemPrompt, messages } = args;
  const timeoutMs = aiRequestTimeoutMs();
  const providerArgs = {
    apiKey: config.apiKey,
    model: config.model,
    systemPrompt,
    messages,
    timeoutMs,
  };

  let raw: string;
  switch (config.provider) {
    case 'openai':
      raw = await generateOpenAi(providerArgs);
      break;
    case 'anthropic':
      raw = await generateAnthropic(providerArgs);
      break;
    case 'openrouter':
      raw = await generateOpenRouter(providerArgs);
      break;
    default:
      throw new AiError(`Unsupported AI provider: ${config.provider}`, {
        code: 'unsupported_provider',
        status: 400,
      });
  }

  return parseGeneration(raw);
}

/**
 * Split the raw model output into `{ text, handoff }`. The sentinel can
 * appear alone or trailing a partial reply; either way we treat the
 * turn as a handoff and strip the marker from any remaining text.
 */
export function parseGeneration(raw: string): GenerateResult {
  const handoff = raw.includes(HANDOFF_SENTINEL);
  const text = collapseRepetition(raw.split(HANDOFF_SENTINEL).join('').trim());
  return { text, handoff };
}

/**
 * Words of a block, lowercased and stripped of punctuation.
 *
 * Stopwords are deliberately NOT removed. It is tempting — they carry
 * little meaning — but they are exactly what two phrasings of the same
 * sentence have in common. Filtering them out of
 *
 *   "Hello! How can I assist you today?"
 *   "hii hello how can i help you today?"
 *
 * leaves {hello, assist, today} against {hii, hello, help, today}, and
 * the restatement stops looking like one.
 */
function tokens(block: string): string[] {
  return block
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/** Below this many words a block is too short to judge. */
const MIN_TOKENS_TO_COMPARE = 4;
/** Share of a block's tokens already present earlier before it is cut. */
const REDUNDANT_AT = 0.7;

/**
 * Drop paragraphs that just restate an earlier one.
 *
 * Small models — and every free tier — habitually answer and then answer
 * again in a different register, so "hello" comes back as
 *
 *   Hello! How can I assist you today?
 *
 *   hii hello how can i help you today?
 *
 * The prompt now forbids this, but a weak model will still do it, and
 * the customer sees the result. Compared on word overlap rather than
 * equality, so a rephrase is caught even though the two lines share no
 * punctuation, casing, or exact wording.
 *
 * Deliberately conservative: blocks under a few real words are left
 * alone (a bare "Yes." following a longer answer is a legitimate reply,
 * not a repeat), and only LATER blocks are ever dropped, so the first
 * and usually best-formed phrasing is the one that survives.
 */
export function collapseRepetition(text: string): string {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length < 2) return text;

  const kept: string[] = [];
  const keptTokens: Set<string>[] = [];

  for (const block of blocks) {
    const words = tokens(block);

    if (words.length < MIN_TOKENS_TO_COMPARE) {
      kept.push(block);
      keptTokens.push(new Set(words));
      continue;
    }

    // Containment, not a symmetric similarity: the question is "does
    // this block add anything", so a short restatement of a long
    // earlier answer still counts as fully redundant.
    const redundant = keptTokens.some((earlier) => {
      const shared = words.filter((t) => earlier.has(t)).length;
      return shared / words.length >= REDUNDANT_AT;
    });

    if (!redundant) {
      kept.push(block);
      keptTokens.push(new Set(words));
    }
  }

  return kept.join('\n\n');
}
