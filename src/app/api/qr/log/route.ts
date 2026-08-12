import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { clientIp } from '@/lib/captcha';
import { RATE_LIMITS, checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { MAX_MESSAGE_CHARS, isValidWaNumber, normalizeWaNumber } from '@/lib/qr/wa-link';

/**
 * POST /api/qr/log — record a code generated on the public tool.
 *
 * Service-role insert rather than an anon-key write from the browser:
 * `qr_generations` has RLS on with no policies precisely so this route
 * is the only way in, which is what makes the rate limit unavoidable
 * rather than decorative (see migration 084).
 *
 * NO CAPTCHA, unlike /api/contact. A captcha is a interruption the
 * visitor has to answer, and this call happens silently behind a
 * button they already pressed — there is nothing to interrupt. The
 * per-IP budget is the whole defence, which is proportionate: the
 * worst case is junk rows in an operator-only table, not an email
 * blast or a mailing-list signup.
 *
 * FAILURE IS NOT THE VISITOR'S PROBLEM. Every error path returns 200.
 * The QR code has already been generated in their browser by the time
 * this fires; a logging failure must never surface as something the
 * person using a free tool has to care about. Real failures are
 * console-warned for the operator.
 */
export async function POST(request: Request) {
  const ip = clientIp(request) ?? 'unknown';
  const limit = checkRateLimit(`qr-log:${ip}`, RATE_LIMITS.qrLog);
  // The one non-200: a 429 carries Retry-After, and the client ignores
  // it anyway. Being honest in the response costs nothing here.
  if (!limit.success) return rateLimitResponse(limit);

  const body = (await request.json().catch(() => null)) as {
    phone?: unknown;
    message?: unknown;
  } | null;
  if (!body) return NextResponse.json({ ok: true });

  // Normalized before storing, so the row matches what the QR encodes
  // rather than whatever spacing was typed. Validated with the same
  // helper the tool uses, so a half-typed number never lands.
  const phone = normalizeWaNumber(
    typeof body.phone === 'string' ? body.phone : ''
  );
  if (!isValidWaNumber(phone)) return NextResponse.json({ ok: true });

  const message =
    typeof body.message === 'string'
      ? body.message.trim().slice(0, MAX_MESSAGE_CHARS)
      : '';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('[qr/log] Supabase env missing — generation not recorded');
    return NextResponse.json({ ok: true });
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await db
    .from('qr_generations')
    .insert({ phone, message: message || null });

  if (error) console.warn('[qr/log] insert failed:', error.message);

  return NextResponse.json({ ok: true });
}
