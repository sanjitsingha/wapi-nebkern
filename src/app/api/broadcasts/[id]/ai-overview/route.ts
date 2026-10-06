import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { loadAiConfig } from '@/lib/ai/config';
import { generateText } from '@/lib/ai/generate';
import { AiError } from '@/lib/ai/types';
import {
  OVERVIEW_MAX_OUTPUT_TOKENS,
  OVERVIEW_SYSTEM_PROMPT,
  OVERVIEW_TIMEOUT_MS,
  basisFromBroadcast,
  buildCampaignFacts,
  buildOverviewMessages,
  parseOverview,
  type OverviewRecipient,
  type OverviewTemplate,
} from '@/lib/ai/campaign-overview';
import type { CampaignAiOverview } from '@/types';

/**
 * POST /api/broadcasts/[id]/ai-overview  (agent+)
 *
 * Returns: { overview, generatedAt, saved }
 *
 * Reads the campaign's results, asks the account's own AI provider (BYO
 * key, the same setup as Maya) for a short verdict, and saves it on the
 * row so the page shows it on the next visit without spending again.
 * Calling it again overwrites the saved one — that is the Refresh button.
 */

// Same paging as the report route: PostgREST caps an unbounded select at
// 1000 rows, and timing/failure figures from the first page alone would
// describe a different campaign.
const PAGE = 1000;
const MAX_ROWS = 100_000;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, accountId } = await requireRole('agent');

    const limit = checkRateLimit(`ai-overview:${accountId}`, RATE_LIMITS.aiOverview);
    if (!limit.success) return rateLimitResponse(limit);

    const { data: broadcast, error: bcError } = await supabase
      .from('broadcasts')
      .select(
        'id, name, status, template_name, template_language, created_at, scheduled_at, total_recipients, sent_count, delivered_count, read_count, replied_count, failed_count',
      )
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle();
    if (bcError) throw bcError;
    if (!broadcast) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if ((broadcast.sent_count ?? 0) === 0 && (broadcast.failed_count ?? 0) === 0) {
      return NextResponse.json(
        {
          error: 'This campaign has not sent anything yet, so there is nothing to review.',
          code: 'nothing_sent',
        },
        { status: 400 },
      );
    }

    const config = await loadAiConfig(supabase, accountId).catch((err) => {
      // Decrypt failure — surface distinctly from "not configured".
      console.error('[ai-overview] loadAiConfig error:', err);
      throw new AiError('Stored API key could not be decrypted.', {
        code: 'key_decrypt_failed',
        status: 400,
      });
    });
    if (!config) {
      return NextResponse.json(
        {
          error: 'Connect an AI provider in Maya settings to get an overview.',
          code: 'ai_not_configured',
        },
        { status: 400 },
      );
    }

    // The template that was sent, so suggestions can be about the copy.
    // Best-effort: a deleted or renamed template just means no copy notes.
    const { data: template } = await supabase
      .from('message_templates')
      .select('category, header_type, header_content, body_text, footer_text, buttons')
      .eq('account_id', accountId)
      .eq('name', broadcast.template_name)
      .eq('language', broadcast.template_language)
      .limit(1)
      .maybeSingle();

    const recipients: OverviewRecipient[] = [];
    let truncated = false;
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data: page, error: recError } = await supabase
        .from('broadcast_recipients')
        .select('status, sent_at, delivered_at, read_at, replied_at, error_message')
        .eq('broadcast_id', id)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1);
      if (recError) throw recError;
      recipients.push(...((page ?? []) as OverviewRecipient[]));
      if (!page || page.length < PAGE) break;
      if (from + PAGE >= MAX_ROWS) truncated = true;
    }

    const facts = buildCampaignFacts({
      broadcast,
      recipients,
      template: (template as OverviewTemplate | null) ?? null,
      recipientsTruncated: truncated,
    });

    const raw = await generateText({
      config,
      systemPrompt: OVERVIEW_SYSTEM_PROMPT,
      messages: buildOverviewMessages(facts),
      maxOutputTokens: OVERVIEW_MAX_OUTPUT_TOKENS,
      timeoutMs: OVERVIEW_TIMEOUT_MS,
    });

    const overview: CampaignAiOverview = {
      ...parseOverview(raw),
      basis: basisFromBroadcast(broadcast),
      provider: config.provider,
      model: config.model,
    };
    const generatedAt = new Date().toISOString();

    // A failed save still returns the overview: the tokens are already
    // spent, and the user should see what they paid for. Most likely
    // cause is migration 105 not being applied yet.
    const { error: saveError } = await supabase
      .from('broadcasts')
      .update({ ai_overview: overview, ai_overview_at: generatedAt })
      .eq('id', id)
      .eq('account_id', accountId);
    if (saveError) {
      console.error('[ai-overview] save failed:', saveError);
    }

    return NextResponse.json({ overview, generatedAt, saved: !saveError });
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
