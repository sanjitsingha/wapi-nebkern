import { NextResponse } from 'next/server';
import { authenticateApiKey, requireApiKey } from '@/lib/api-keys/auth';
import { supabaseAdmin } from '@/lib/webhooks/admin-client';
import { sanitizePhoneForMeta, isValidE164, normalizePhone } from '@/lib/whatsapp/phone-utils';
import { decrypt } from '@/lib/whatsapp/encryption';
import { findExistingContact, isUniqueViolation } from '@/lib/contacts/dedupe';
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api';
import { isMessageTemplate } from '@/lib/whatsapp/template-row-guard';
import type { SendTimeParams } from '@/lib/whatsapp/template-send-builder';

/**
 * POST /api/v1/messages
 *
 * Send a WhatsApp template message to any recipient — the "action" side
 * for automation platforms (Zapier/Make/n8n) and custom backends.
 *
 * Auth: x-api-key with the `send:messages` scope.
 *
 * Body (simple — body variables only):
 *   { "to": "+15551234567",
 *     "template": { "name": "hello_world", "language": "en_US" },
 *     "params": ["John", "Monday"] }
 *
 * Body (advanced — headers, buttons, media):
 *   { "to": "+15551234567",
 *     "template": { "name": "hello_world", "language": "en_US" },
 *     "messageParams": {
 *       "body": ["John", "Monday"],
 *       "headerText": "Reminder",
 *       "headerMediaUrl": "https://example.com/image.jpg",
 *       "buttonParams": { "0": "https://example.com/confirm" } } }
 */
export async function POST(request: Request) {
  try {
    const apiAuth = await authenticateApiKey(request);
    const auth = requireApiKey(apiAuth, ['send:messages']);
    if (auth instanceof NextResponse) return auth;
    const { accountId, userId } = auth;

    const body = await request.json().catch(() => null);
    const { to, template, params, messageParams } = body ?? {};

    if (!to || typeof to !== 'string') {
      return NextResponse.json({ error: '`to` (phone number) is required' }, { status: 400 });
    }
    const sanitizedPhone = sanitizePhoneForMeta(to);
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number. Use E.164 (e.g. +15551234567).' },
        { status: 400 },
      );
    }

    const templateName = template?.name;
    if (!templateName || typeof templateName !== 'string') {
      return NextResponse.json({ error: '`template.name` is required' }, { status: 400 });
    }
    const language = template?.language || 'en_US';

    const supabase = supabaseAdmin();

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .single();
    if (!config) {
      return NextResponse.json(
        { error: 'WhatsApp is not configured for this account.' },
        { status: 400 },
      );
    }

    const { data: rawTemplateRow } = await supabase
      .from('message_templates')
      .select('*')
      .eq('account_id', accountId)
      .eq('name', templateName)
      .maybeSingle();
    if (rawTemplateRow && !isMessageTemplate(rawTemplateRow)) {
      return NextResponse.json(
        { error: 'Template row is malformed locally. Run "Sync from Meta" in Settings.' },
        { status: 500 },
      );
    }

    const sendArgs: {
      phoneNumberId: string;
      accessToken: string;
      to: string;
      templateName: string;
      language: string;
      template?: import('@/types').MessageTemplate;
      params?: string[];
      messageParams?: SendTimeParams;
    } = {
      phoneNumberId: config.phone_number_id,
      accessToken: decrypt(config.access_token),
      to: sanitizedPhone,
      templateName,
      language,
      template: rawTemplateRow ?? undefined,
    };

    if (messageParams && typeof messageParams === 'object') {
      const mp: SendTimeParams = {};
      if (Array.isArray(messageParams.body)) mp.body = messageParams.body;
      if (typeof messageParams.headerText === 'string') mp.headerText = messageParams.headerText;
      if (typeof messageParams.headerMediaUrl === 'string') mp.headerMediaUrl = messageParams.headerMediaUrl;
      if (typeof messageParams.headerMediaId === 'string') mp.headerMediaId = messageParams.headerMediaId;
      if (messageParams.buttonParams && typeof messageParams.buttonParams === 'object') {
        mp.buttonParams = messageParams.buttonParams as Record<number, string>;
      }
      sendArgs.messageParams = mp;
    } else if (Array.isArray(params)) {
      sendArgs.params = params.map((p) => String(p));
    }

    const result = await sendTemplateMessage(sendArgs);

    // Render the template body with its variables so the inbox bubble shows
    // real text — the same thing the composer stores as content_text. Body
    // values come from messageParams.body (advanced) or params (simple).
    const bodyValues: unknown[] =
      messageParams && Array.isArray(messageParams.body)
        ? messageParams.body
        : Array.isArray(params)
          ? params
          : [];
    const renderedBody =
      typeof rawTemplateRow?.body_text === 'string'
        ? renderTemplateBody(rawTemplateRow.body_text, bodyValues.map(String))
        : null;

    // Mirror the send into the CRM so it shows in the inbox just like an
    // app-sent template. BEST-EFFORT: the message has already left Meta,
    // so a persistence failure must never surface as an error — that would
    // make Zapier/Make retry the step and double-send to the customer. We
    // log and still return success.
    let conversationId: string | null = null;
    try {
      conversationId = await recordOutboundTemplate({
        db: supabase,
        accountId,
        userId,
        phone: normalizePhone(to),
        templateName,
        contentText: renderedBody,
        waMessageId: result.messageId,
      });
    } catch (persistErr) {
      console.error('[v1/messages] sent to Meta but inbox persist failed:', persistErr);
    }

    return NextResponse.json({
      success: true,
      message_id: result.messageId,
      conversation_id: conversationId,
      template_name: templateName,
      phone: sanitizedPhone,
    });
  } catch (err) {
    console.error('[v1/messages] error:', err);
    // Surface the real reason. sendTemplateMessage (via throwMetaError)
    // produces an actionable message — which template field Meta rejected,
    // "Recipient phone number not in allowed list", an expired token, etc.
    // A caller on Zapier/Make only ever sees this string, so hiding it
    // behind a generic "Failed to send message" makes the send undebuggable.
    const detail = err instanceof Error ? err.message : 'Failed to send message';
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}

/**
 * Substitute {{1}}, {{2}}, … in a template body with the supplied values,
 * leaving any placeholder without a value intact. Mirrors the composer's
 * renderTemplateBody so API-sent and app-sent templates read identically
 * in the inbox.
 */
function renderTemplateBody(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, raw) => {
    const idx = Number(raw) - 1;
    return params[idx] ?? `{{${raw}}}`;
  });
}

interface RecordOutboundArgs {
  db: ReturnType<typeof supabaseAdmin>;
  accountId: string;
  userId: string;
  /** Normalized (digits-only) recipient phone. */
  phone: string;
  templateName: string;
  /** Rendered template body for the bubble + preview; null if unknown. */
  contentText: string | null;
  /** Meta's wamid for the sent template. */
  waMessageId: string;
}

/**
 * Persist an API-sent template into contacts / conversations / messages
 * so it appears in the inbox exactly like an app-sent template. Creates
 * the contact and conversation when the recipient is new — the same
 * find-or-create the inbound webhook does — then inserts an 'agent'
 * template message and bumps the conversation preview.
 *
 * Returns the conversation id, or null when any step failed. The caller
 * treats this as best-effort: the WhatsApp message has already been sent,
 * so a null here is logged, not surfaced as an API error.
 */
async function recordOutboundTemplate(args: RecordOutboundArgs): Promise<string | null> {
  const { db, accountId, userId, phone, templateName, contentText, waMessageId } = args;

  // Find or create the contact by phone (suffix-matched dedup — same
  // helper the webhook, manual add, and CSV import use, so all paths
  // agree on "same number").
  const existing = await findExistingContact(db, accountId, phone);
  let contactId = existing?.id ?? null;
  if (!contactId) {
    const { data: created, error } = await db
      .from('contacts')
      .insert({ account_id: accountId, user_id: userId, phone, name: phone })
      .select('id')
      .single();
    if (error) {
      // Lost a race with a concurrent create — re-resolve the winner.
      if (isUniqueViolation(error)) {
        const raced = await findExistingContact(db, accountId, phone);
        contactId = raced?.id ?? null;
      }
      if (!contactId) {
        console.error('[v1/messages] contact create failed:', error);
        return null;
      }
    } else {
      contactId = created.id;
    }
  }

  // Find or create the conversation (oldest wins, mirroring the webhook's
  // dedup-tolerant lookup).
  let conversationId: string | null = null;
  const { data: convRows } = await db
    .from('conversations')
    .select('id')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true })
    .limit(1);
  if (convRows && convRows.length > 0) {
    conversationId = convRows[0].id as string;
  } else {
    const { data: newConv, error } = await db
      .from('conversations')
      .insert({ account_id: accountId, user_id: userId, contact_id: contactId })
      .select('id')
      .single();
    if (error) {
      if (isUniqueViolation(error)) {
        const { data: raced } = await db
          .from('conversations')
          .select('id')
          .eq('account_id', accountId)
          .eq('contact_id', contactId)
          .order('created_at', { ascending: true })
          .limit(1);
        conversationId = (raced?.[0]?.id as string | undefined) ?? null;
      }
      if (!conversationId) {
        console.error('[v1/messages] conversation create failed:', error);
        return null;
      }
    } else {
      conversationId = newConv.id as string;
    }
  }

  // Insert the outbound template message. sender_type='agent' matches the
  // manual send route; content_text carries the rendered body so the inbox
  // bubble shows real text, exactly like an app-sent template.
  const { error: msgError } = await db.from('messages').insert({
    conversation_id: conversationId,
    sender_type: 'agent',
    content_type: 'template',
    content_text: contentText,
    template_name: templateName,
    message_id: waMessageId,
    status: 'sent',
  });
  if (msgError) {
    console.error('[v1/messages] message insert failed:', msgError);
    return null;
  }

  // Bump the conversation so it sorts to the top of the inbox with a
  // sensible preview, matching the automations sender.
  const now = new Date().toISOString();
  await db
    .from('conversations')
    .update({
      last_message_text: contentText || `[template:${templateName}]`,
      last_message_at: now,
      updated_at: now,
    })
    .eq('id', conversationId);

  return conversationId;
}
