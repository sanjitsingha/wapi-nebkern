/**
 * Human-readable mapping and formatting for WhatsApp Cloud API & Meta Graph API errors.
 *
 * Translates cryptic codes (e.g. 131047, 131026, OAuthException 190) into
 * actionable, crystal-clear explanations so users know EXACTLY what happened
 * and how to resolve it.
 */

export const META_ERROR_CODE_MAP: Record<
  number,
  { title: string; explanation: string; action?: string }
> = {
  131047: {
    title: '24-Hour Window Expired',
    explanation:
      'More than 24 hours have passed since the customer last messaged you. Free-form text and media cannot be sent outside the 24-hour service window.',
    action: 'Send an approved WhatsApp Template to reopen the conversation.',
  },
  131026: {
    title: 'Message Undeliverable',
    explanation:
      'WhatsApp could not deliver the message to the recipient (phone is offline, inactive, unreachable, or privacy/block settings prevent delivery).',
    action: 'Verify the recipient’s phone number and WhatsApp connectivity.',
  },
  131051: {
    title: 'Unsupported Message Type',
    explanation:
      'The recipient’s WhatsApp client or device does not support this type of interactive message or content.',
    action: 'Send standard text or a standard approved template instead.',
  },
  131052: {
    title: 'Media Download Failed',
    explanation:
      'The recipient’s device failed to download the media asset from Meta servers.',
    action: 'Check that the media URL is publicly accessible and re-upload if needed.',
  },
  131053: {
    title: 'Media Upload Failed',
    explanation:
      'The media format, file size, or encoding is unsupported by WhatsApp Cloud API.',
    action: 'Use standard formats (JPEG/PNG for images, MP4 for video, PDF for documents).',
  },
  131057: {
    title: 'Daily Messaging Tier Limit Reached',
    explanation:
      'Your WhatsApp Business Account has reached its 24-hour limit for business-initiated conversations.',
    action: 'Wait for the 24-hour limit window to reset or upgrade your tier in Meta Business Manager.',
  },
  130429: {
    title: 'Rate Limit Hit',
    explanation: 'Too many messages sent too quickly across the account.',
    action: 'Wait a few moments before sending again.',
  },
  130472: {
    title: 'Payment Method Issue',
    explanation:
      'There is a payment or billing issue on your Meta WhatsApp Business Account (WABA).',
    action: 'Check payment methods and billing status in Meta Business Manager.',
  },
  131000: {
    title: 'Meta Service Temporary Error',
    explanation:
      'A temporary internal service error occurred on Meta Cloud API servers.',
    action: 'Please wait a moment and retry sending.',
  },
  131005: {
    title: 'Access Denied by Meta',
    explanation: 'Your account lacks permission to send to this number.',
    action: 'Verify WhatsApp Business Account permissions in Meta Business Manager.',
  },
  190: {
    title: 'Access Token Expired or Invalid',
    explanation: 'The WhatsApp Business API token has expired or was revoked.',
    action: 'Reconnect or re-authenticate your WhatsApp account in Settings.',
  },
  100: {
    title: 'Invalid Request Parameter',
    explanation: 'A parameter, variable value, or phone number format is invalid.',
    action: 'Check template variable placeholders and ensure phone numbers have country code.',
  },
  33: {
    title: 'Invalid Phone Number',
    explanation: 'The recipient phone number is not a valid number on WhatsApp.',
    action: 'Confirm the phone number with country code.',
  },

  // ── Template failures (132xxx) ──
  //
  // The most common cause of a failed send after the first week, and
  // the family that was missing entirely — every one of these used to
  // arrive as Meta's raw text or, worse, as the generic
  // "Undeliverable". They are also the most fixable: each names a
  // specific thing wrong with the template or its parameters.
  132000: {
    title: 'Template Parameter Count Mismatch',
    explanation:
      'The number of variables supplied does not match the number the approved template expects.',
    action:
      'Open the template and count its {{n}} placeholders, then supply exactly that many values.',
  },
  132001: {
    title: 'Template Not Found',
    explanation:
      'No approved template exists with that name in that language for this WhatsApp Business Account.',
    action:
      'Check the template name and language code (e.g. en_US vs en) — a template approved in one language is not available in another.',
  },
  132005: {
    title: 'Template Text Too Long',
    explanation:
      'The template text after filling in the variables exceeds WhatsApp’s length limit.',
    action: 'Shorten the values being passed, or the template body itself.',
  },
  132007: {
    title: 'Template Format Violation',
    explanation:
      'A parameter contains characters the template policy forbids — usually a newline, a tab, or more than four consecutive spaces.',
    action:
      'Strip line breaks and repeated spaces from the values you pass into template variables.',
  },
  132012: {
    title: 'Template Parameter Format Mismatch',
    explanation:
      'A value does not match the format the template was approved with — commonly a currency or date-time parameter given as plain text.',
    action:
      'Match the example values the template was approved with, including type and shape.',
  },
  132015: {
    title: 'Template Paused for Quality',
    explanation:
      'Meta has paused this template because recipients marked it as unwanted. Sends will resume automatically if quality recovers.',
    action:
      'Check the template’s quality rating in Meta Business Manager, and send it to a narrower, more relevant audience.',
  },
  132016: {
    title: 'Template Disabled',
    explanation:
      'This template has been permanently disabled by Meta for repeated quality problems. It cannot be re-enabled.',
    action: 'Create a new template with different content.',
  },
  132068: {
    title: 'Flow Is Blocked',
    explanation: 'The WhatsApp Flow attached to this template is blocked.',
    action: 'Check the Flow’s status in Meta Business Manager.',
  },

  // ── Parameter and recipient problems ──
  131008: {
    title: 'Required Parameter Missing',
    explanation: 'The request left out a field WhatsApp requires.',
    action:
      'For a template with a dynamic URL or copy-code button, this usually means the button value was not supplied.',
  },
  131009: {
    title: 'Parameter Value Invalid',
    explanation:
      'A value in the request is not one WhatsApp accepts for that field.',
    action:
      'Check variable values, media URLs and the phone number format against Meta’s requirements.',
  },
  131021: {
    title: 'Sender and Recipient Are the Same',
    explanation:
      'The message was addressed to the same number that is sending it.',
    action: 'Send to the customer’s number, not your own business number.',
  },
  131056: {
    title: 'Too Many Messages to This Contact',
    explanation:
      'A pair rate limit was hit — too many messages between your number and this one specific recipient in a short window.',
    action: 'Wait before messaging this contact again.',
  },
  133010: {
    title: 'Phone Number Not Registered',
    explanation:
      'Your business phone number has not completed registration with WhatsApp Cloud API.',
    action: 'Finish number registration in Settings → WhatsApp.',
  },

  // ── Account-level problems ──
  //
  // These stop every send, not just one. Worth their own wording so a
  // reader does not spend an afternoon debugging one message.
  131031: {
    title: 'Business Account Restricted',
    explanation:
      'Your WhatsApp Business Account has been locked or restricted by Meta, so no messages can be sent.',
    action:
      'Open Meta Business Manager — there is normally an appeal or a verification step waiting there.',
  },
  131042: {
    title: 'Business Eligibility / Payment Problem',
    explanation:
      'Meta will not send on this account because of a billing or eligibility issue on the WABA.',
    action:
      'Check the payment method and business verification status in Meta Business Manager.',
  },
  131045: {
    title: 'Number Not Registered for Sending',
    explanation:
      'The sending phone number has no valid certificate registered with Meta.',
    action: 'Re-register the number in Settings → WhatsApp.',
  },
  131049: {
    title: 'Held Back for Recipient Experience',
    explanation:
      'Meta chose not to deliver this marketing message to protect the recipient from too many promotional messages. This is not a fault in the message.',
    action:
      'Nothing to fix on this send. Reduce marketing frequency to this contact.',
  },
  130497: {
    title: 'Send Limit Reached',
    explanation:
      'This account has hit a Meta-imposed limit on messages of this kind.',
    action: 'Wait for the limit window to reset.',
  },
  135000: {
    title: 'Message Rejected by Meta',
    explanation:
      'Meta declined the message without giving a specific reason. This is usually a malformed request rather than a delivery problem.',
    action:
      'Check the template name, language and parameters, then retry once.',
  },
};

/**
 * Pull the Meta code back out of a stored `error_message`.
 *
 * The formatter writes `[Code 132001] …`, so the code survives in the
 * text — which is what lets the dashboard group failures by cause
 * without a separate column for it. Rows written before that format
 * (or by a path that stored Meta's raw text) simply have no code, and
 * group under their own text instead.
 */
export function extractErrorCode(stored: string | null | undefined): number | null {
  if (!stored) return null;
  const m = stored.match(/\[Code\s+(\d{2,6})/i);
  if (m) return parseInt(m[1], 10);
  // Older rows: Meta's own "(#131047)" shape.
  const legacy = stored.match(/\(#(\d{2,6})\)/);
  return legacy ? parseInt(legacy[1], 10) : null;
}

/**
 * A short label for a stored error — the mapped title when the code is
 * known, otherwise the first line of whatever was saved.
 */
export function errorSummary(stored: string | null | undefined): string {
  const code = extractErrorCode(stored);
  const known = code ? META_ERROR_CODE_MAP[code] : null;
  if (known) return known.title;
  const firstLine = (stored ?? '').split('\n')[0]?.trim();
  return firstLine || 'Unknown delivery error';
}

export interface RawMetaErrorInput {
  code?: number | string | null;
  subcode?: number | string | null;
  title?: string | null;
  message?: string | null;
  details?: string | null;
  userTitle?: string | null;
  userMsg?: string | null;
}

/**
 * Formats any raw Meta error into a clear, informative error description.
 */
export function formatDetailedMetaError(
  err: RawMetaErrorInput | string | null | undefined,
): string {
  if (!err) return 'Delivery failed — Meta gave no error details.';

  if (typeof err === 'string') {
    const trimmed = err.trim();
    if (!trimmed) return 'Delivery failed — Meta gave no error details.';

    // Check if error string already contains a code like (#131047) or Code 131047
    const codeMatch = trimmed.match(/(?:#|code\s*|code\s*:?\s*)(\d{3,6})/i);
    if (codeMatch) {
      const codeNum = parseInt(codeMatch[1], 10);
      const known = META_ERROR_CODE_MAP[codeNum];
      if (known) {
        return `[Code ${codeNum}] ${known.title}: ${known.explanation} ${known.action ? `→ ${known.action}` : ''}`;
      }
    }
    return trimmed;
  }

  const codeNum = typeof err.code === 'number' ? err.code : err.code ? parseInt(String(err.code), 10) : null;
  const known = codeNum && !isNaN(codeNum) ? META_ERROR_CODE_MAP[codeNum] : null;

  const parts: string[] = [];

  if (known) {
    parts.push(`[Code ${codeNum}] ${known.title}`);
    parts.push(known.explanation);

    // Meta's own detail on TOP of ours, not instead of it. It used to
    // replace the explanation, which meant a terse "Invalid parameter"
    // from Meta displaced the sentence that said what to actually do.
    // The two answer different questions: ours says what this class of
    // failure means, Meta's says which field broke this time.
    const specifics = [err.details, err.userMsg].filter(
      (s): s is string =>
        !!s && s !== err.message && !parts.some((p) => p.includes(s)),
    );
    if (specifics.length) parts.push(`Meta said: ${specifics.join(' ')}`);

    if (known.action) {
      parts.push(`→ ${known.action}`);
    }
  } else {
    // Unknown code. Meta's own text is the best information available,
    // so surface ALL of it rather than the first field that is set —
    // `error_data.details` in particular carries the specific reason
    // ("template name does not exist in en_US") where `message` is
    // often just the family ("Template name error").
    //
    // The code is always printed, even when nothing is known about it:
    // it is the one thing that makes a search or a support ticket
    // productive, and dropping it is what turns a report into "it says
    // it failed".
    if (codeNum) {
      parts.push(
        err.subcode ? `[Code ${codeNum}/${err.subcode}]` : `[Code ${codeNum}]`,
      );
    }
    if (err.userTitle) parts.push(err.userTitle);
    if (err.userMsg) parts.push(err.userMsg);
    if (err.details) parts.push(err.details);
    if (err.title && err.title !== err.message && !parts.includes(err.title)) parts.push(err.title);
    if (err.message && !parts.includes(err.message)) parts.push(err.message);
  }

  // Newlines, not em-dashes. Several of the parts contain em-dashes of
  // their own, so joining with one produced a single run with no
  // visible seam between "what happened" and "what to do". Callers
  // render this with `whitespace-pre-line` (see the failed-message
  // tooltip in message-bubble.tsx) so the stack reads at a glance.
  const result = parts.filter(Boolean).join('\n');
  // Last resort, and worded as an admission rather than a diagnosis:
  // "Undeliverable" sounds like a finding, and reaching this line means
  // we have nothing.
  return result || 'Delivery failed — Meta gave no error details.';
}
