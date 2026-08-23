import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/account/admin-client';
import { isMailConfigured, sendMail } from '@/lib/email/deomail';
import { passwordResetEmail } from '@/lib/email/auth-templates';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * POST /api/auth/password-reset  { email }
 *
 * Sends the six-digit recovery code through DeoMail instead of letting
 * Supabase's built-in SMTP send it.
 *
 * WHY NOT SUPABASE'S CUSTOM SMTP, WHICH WOULD NEED NO CODE AT ALL
 *
 * Because DeoMail has no SMTP relay to point it at. Their own FAQ:
 * "DeoMail uses its own sending infrastructure. Direct SMTP relay for
 * external applications is handled through the API's send endpoint."
 * IMAP/POP3 for third-party clients is off too. The "full SMTP" on
 * their pricing page is their internal delivery, not credentials you
 * are given. So the HTTP API is the only way out of DeoMail, and this
 * route is what it takes to use it.
 *
 * WHAT MOVED, AND WHAT DID NOT
 *
 * Only delivery. The code is still Supabase's: `generateLink` mints a
 * real recovery token against auth.users and hands back its OTP form
 * WITHOUT sending anything — which is the entire reason this route can
 * exist. The client still calls `verifyOtp({ type: 'recovery' })` with
 * the same code and still gets a real session out of it, so nothing
 * about how the credential is issued, checked or expired has changed.
 * If it had, this would be a security rewrite rather than a mail one.
 *
 * THE REPLY IS THE SAME EITHER WAY
 *
 * Unauthenticated and takes an email address, so a truthful answer
 * would make it an oracle for "is this address registered". Every path
 * below returns the same accepted body — user missing, generateLink
 * refused, send failed. Only the two conditions that are independent of
 * the address say otherwise: rate limiting, and a transport that is not
 * configured at all.
 */

/**
 * Mirrors Supabase Auth's OTP expiry (Authentication → Providers →
 * Email → "Email OTP Expiration", 3600s by default). Only used for the
 * sentence in the email — the real expiry is enforced by Supabase — so
 * getting it wrong misinforms rather than breaks. Keep the two in step.
 */
const OTP_EXPIRY_MINUTES = 60;

/** Per address. The UI already sits behind a 60s resend cooldown; this
 *  is the backstop for someone driving the endpoint directly. */
const PER_EMAIL = { limit: 5, windowMs: 15 * 60 * 1000 };

/** Per caller, so one source cannot walk a list of addresses through
 *  the per-email budget one at a time. */
const PER_IP = { limit: 15, windowMs: 15 * 60 * 1000 };

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email =
    body && typeof body === 'object' && typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : '';

  // One response object for every outcome below. See the header.
  const accepted = NextResponse.json({
    ok: true,
    message:
      'If that address belongs to an account, a six-digit code is on its way.',
  });

  if (!email || !email.includes('@')) return accepted;

  const ipLimit = checkRateLimit(`pw-reset:ip:${clientIp(request)}`, PER_IP);
  if (!ipLimit.success) return rateLimitResponse(ipLimit);

  const emailLimit = checkRateLimit(`pw-reset:email:${email}`, PER_EMAIL);
  if (!emailLimit.success) return rateLimitResponse(emailLimit);

  // Checked before the lookup, and answered honestly, because it does
  // not depend on the address: a deployment with no mail transport
  // cannot send anyone a code, and silently returning "on its way"
  // would leave every user staring at a code entry screen forever.
  if (!isMailConfigured('otp')) {
    console.error(
      '[password-reset] DEOMAIL_API_KEY or the "otp" sender is not configured'
    );
    return NextResponse.json(
      { error: 'Email is not configured on this deployment.' },
      { status: 503 }
    );
  }

  try {
    const admin = supabaseAdmin();

    // Generates the token; does NOT send mail. Errors for an address
    // with no user, which is one of the paths that must stay quiet.
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    const code = data?.properties?.email_otp;
    if (error || !code) {
      // Logged at warn volume: "no such user" is the ordinary case
      // here, not a fault worth an error line on every typo.
      console.warn(
        `[password-reset] no code issued for a requested address: ${error?.message ?? 'no email_otp in response'}`
      );
      return accepted;
    }

    const mail = passwordResetEmail({
      code,
      expiresMinutes: OTP_EXPIRY_MINUTES,
    });

    // `sendMail`, not `sendMailQuietly` — the send IS the work here
    // rather than a side effect of it, so the result is worth a log
    // line of its own. The caller still gets `accepted` either way.
    //
    // Sent as `otp` — no-reply@MAIL_DOMAIN. A code is the one email
    // where a no-reply address is the honest answer: there is nothing
    // to reply to, and the six digits are the whole message.
    //
    // A SENDER_NOT_AUTHORIZED here means that address is not verified in
    // DeoMail. That was the original cause of "no code ever arrives",
    // and it fails silently by design — so this log line is the only
    // place it surfaces. See the verified list in senders.ts.
    const result = await sendMail({ from: 'otp', to: email, ...mail });
    if (!result.ok) {
      console.error(
        `[password-reset] send failed: ${result.error}${result.code ? ` (${result.code})` : ''}`
      );
    }
  } catch (err) {
    console.error('[password-reset] request failed:', err);
  }

  return accepted;
}
