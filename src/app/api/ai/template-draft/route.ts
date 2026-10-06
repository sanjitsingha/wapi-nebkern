import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { loadAiConfig } from '@/lib/ai/config';
import { generateText } from '@/lib/ai/generate';
import { STRUCTURED_MAX_OUTPUT_TOKENS, STRUCTURED_TIMEOUT_MS } from '@/lib/ai/defaults';
import { AiError } from '@/lib/ai/types';
import {
  MAX_PROMPT_CHARS,
  TEMPLATE_SYSTEM_PROMPT,
  buildTemplateMessages,
  parseTemplateDraft,
} from '@/lib/ai/template-draft';

/**
 * POST /api/ai/template-draft  (agent+)
 *
 * Body: { prompt, language? }
 * Returns: { draft, notes } — a whole template for the builder to fill
 * its form with, and anything the user still has to supply.
 *
 * Uses the account's configured provider/key (BYO, as Maya does).
 * Read-only: nothing is saved or sent to Meta; the user reviews the form
 * and submits it the usual way.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent');

    // Same budgets as Draft with AI: per person, and per account on the
    // shared provider key.
    const userLimit = checkRateLimit(`ai-template:${userId}`, RATE_LIMITS.aiDraft);
    if (!userLimit.success) return rateLimitResponse(userLimit);
    const accountLimit = checkRateLimit(`ai-draft-acct:${accountId}`, RATE_LIMITS.aiDraftAccount);
    if (!accountLimit.success) return rateLimitResponse(accountLimit);

    const body = await request.json().catch(() => null);
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const language =
      typeof body?.language === 'string' && body.language.trim()
        ? body.language.trim()
        : 'en_US';
    if (!prompt) {
      return NextResponse.json(
        { error: 'Tell Maya what the message is for.', code: 'prompt_required' },
        { status: 400 },
      );
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return NextResponse.json(
        {
          error: `Keep the request under ${MAX_PROMPT_CHARS.toLocaleString()} characters.`,
          code: 'prompt_too_long',
        },
        { status: 400 },
      );
    }

    const config = await loadAiConfig(supabase, accountId).catch((err) => {
      // Decrypt failure — surface distinctly from "not configured".
      console.error('[ai/template-draft] loadAiConfig error:', err);
      throw new AiError('Stored API key could not be decrypted.', {
        code: 'key_decrypt_failed',
        status: 400,
      });
    });
    if (!config) {
      return NextResponse.json(
        {
          error: 'Connect an AI provider in Maya settings to write templates with Maya.',
          code: 'ai_not_configured',
        },
        { status: 400 },
      );
    }

    const raw = await generateText({
      config,
      systemPrompt: TEMPLATE_SYSTEM_PROMPT,
      messages: buildTemplateMessages(prompt, language),
      maxOutputTokens: STRUCTURED_MAX_OUTPUT_TOKENS,
      timeoutMs: STRUCTURED_TIMEOUT_MS,
    });

    return NextResponse.json(parseTemplateDraft(raw, { prompt, defaultLanguage: language }));
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return toErrorResponse(err);
  }
}
