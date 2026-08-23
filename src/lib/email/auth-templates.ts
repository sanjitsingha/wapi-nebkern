import { shell, site, INK, SOFT } from './shell';

/**
 * Authentication emails we send ourselves rather than leaving to
 * Supabase's built-in SMTP.
 *
 * Supabase can send these from its own templates, but that mail leaves
 * as Supabase's sender on Supabase's reputation, and the template lives
 * in a dashboard rather than in this repo. Sending through DeoMail puts
 * it on the verified domain the rest of the app's mail goes out as, and
 * puts the copy under review like everything else.
 *
 * The token itself is still Supabase's — see the password-reset route.
 * Nothing here mints or validates a credential; this is presentation.
 */

/** Monospaced, spaced out, and big enough to read off a lock screen. */
function codeBlock(code: string): string {
  return `<div style="margin:0 0 24px;padding:18px 20px;background:#f5f5f4;border-radius:10px;text-align:center;">
  <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:0.28em;color:${INK};">${code}</span>
</div>`;
}

/**
 * The six-digit password reset code.
 *
 * The code is in the SUBJECT as well as the body on purpose: it is the
 * half people read off a notification without opening anything, which
 * is most of them on a phone.
 */
export function passwordResetEmail({
  code,
  expiresMinutes,
}: {
  code: string;
  expiresMinutes: number;
}) {
  const window =
    expiresMinutes >= 60
      ? `${Math.round(expiresMinutes / 60)} hour${expiresMinutes >= 120 ? 's' : ''}`
      : `${expiresMinutes} minutes`;

  return {
    subject: `${code} is your Instant password reset code`,
    html: shell(
      `<p style="margin:0 0 14px;">Someone asked to reset the password on your Instant account. Enter this code on the reset page to choose a new one:</p>
       ${codeBlock(code)}
       <p style="margin:0 0 14px;">The code expires in ${window} and can be used once.</p>
       <p style="margin:0;color:${SOFT};">If this wasn't you, you can ignore this email — nothing has changed, and your password stays as it is.</p>`,
      // No unsubscribe link, deliberately: this is transactional mail
      // sent in response to a request, not something anyone opted into
      // or can opt out of without losing access to their own account.
      `Sent by Instant · <a href="${site()}" style="color:${SOFT};">${site().replace(/^https?:\/\//, '')}</a><br>
       We will never ask you for this code by phone, chat or reply.`
    ),
    text: `Someone asked to reset the password on your Instant account.

Your code is: ${code}

Enter it on the reset page to choose a new password. The code expires in
${window} and can be used once.

If this wasn't you, you can ignore this email — nothing has changed, and
your password stays as it is.

We will never ask you for this code by phone, chat or reply.

---
Sent by Instant · ${site()}`,
  };
}
