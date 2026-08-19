/**
 * DeoMail transport — https://deomail.com/api
 *
 * One function, `sendMail`, wrapping `POST https://api.deomail.com/v1/send`.
 * Everything about the provider lives here so swapping it later touches
 * one file rather than every route that sends something.
 *
 * SERVER ONLY. The key authenticates sending from your verified domain,
 * so it must never reach the browser — note the env vars are
 * deliberately not `NEXT_PUBLIC_`.
 */

import { resolveSender, type SenderKey } from './senders';

const ENDPOINT = 'https://api.deomail.com/v1/send';

/** Errors worth retrying later vs. ones that will fail identically
 *  every time. Only used for how loudly we log — see sendMail. */
const TRANSIENT = new Set([
  'RATE_LIMITED',
  'QUOTA_EXCEEDED',
  'DELIVERY_FAILED',
  'INTERNAL_ERROR',
]);

export interface MailResult {
  ok: boolean;
  /** DeoMail's id for the accepted message, for cross-referencing in
   *  their dashboard when someone says they never got the email. */
  messageId?: string;
  error?: string;
  code?: string;
}

/**
 * True when the transport can send as `sender`.
 *
 * Per-sender, not global: the key may be present while the address for
 * one particular purpose is not. Callers check this rather than letting
 * a send fail, because a missing address is a deployment gap and not a
 * runtime error worth surfacing to a visitor who just signed up.
 */
export function isMailConfigured(sender: SenderKey): boolean {
  return Boolean(process.env.DEOMAIL_API_KEY?.trim() && resolveSender(sender));
}

export interface MailArgs {
  /** Which of the app's addresses this goes out as — see senders.ts.
   *  A key rather than a literal so every from-address stays in the one
   *  list that has to match DeoMail's verified senders. */
  from: SenderKey;
  to: string;
  subject: string;
  html: string;
  /** Always pass one. Some clients render text/plain by preference, and
   *  a missing text part is a spam signal in its own right. */
  text: string;
}

export async function sendMail({
  from,
  to,
  subject,
  html,
  text,
}: MailArgs): Promise<MailResult> {
  const key = process.env.DEOMAIL_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: 'DEOMAIL_API_KEY not set' };
  }

  const sender = resolveSender(from);
  if (!sender) {
    return {
      ok: false,
      error: `no address for sender "${from}" — set MAIL_DOMAIN or MAIL_FROM_${from.toUpperCase()}`,
    };
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-Key': key,
        'Content-Type': 'application/json',
      },
      // `from` must be the BARE address — DeoMail matches the whole
      // string against its verified senders, so `Name <addr>` reads as
      // an unknown sender. `from_name` carries the display name
      // separately; it is undocumented and may be ignored, in which
      // case the name shown is whatever DeoMail holds against the
      // verified address. `to` is an array even for one recipient.
      body: JSON.stringify({
        from: sender.address,
        from_name: sender.name,
        to: [to],
        subject,
        html,
        text,
      }),
    });
  } catch (err) {
    // DNS failure, timeout, TLS — never reached the API at all.
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }

  const data = (await res.json().catch(() => null)) as {
    success?: boolean;
    message_id?: string;
    error?: string;
    code?: string;
  } | null;

  if (!res.ok || !data?.success) {
    return {
      ok: false,
      error: data?.error ?? `HTTP ${res.status}`,
      code: data?.code,
    };
  }

  return { ok: true, messageId: data.message_id };
}

/**
 * Send and log, never throw.
 *
 * Every caller here sends email as a side effect of something that has
 * already succeeded — the row is written, the person IS subscribed. A
 * failed email must not turn that into an error the visitor sees, so
 * this swallows the result into the log and returns.
 */
export async function sendMailQuietly(
  args: MailArgs,
  context: string
): Promise<void> {
  if (!isMailConfigured(args.from)) {
    console.warn(
      `[email] ${context} skipped — DEOMAIL_API_KEY or the "${args.from}" sender address is not configured`
    );
    return;
  }

  const result = await sendMail(args);
  if (result.ok) return;

  // A transient failure means "try again later"; anything else is a
  // misconfiguration that will keep failing until someone looks at it,
  // so it gets the louder level.
  const transient = result.code ? TRANSIENT.has(result.code) : false;
  const line = `[email] ${context} failed: ${result.error}${result.code ? ` (${result.code})` : ''}`;
  if (transient) console.warn(line);
  else console.error(line);
}
