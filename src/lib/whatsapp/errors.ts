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
};

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
  if (!err) return 'Message delivery failed (Undeliverable)';

  if (typeof err === 'string') {
    const trimmed = err.trim();
    if (!trimmed) return 'Message delivery failed (Undeliverable)';

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
    if (err.details && err.details !== err.message) {
      parts.push(err.details);
    } else {
      parts.push(known.explanation);
    }
    if (known.action) {
      parts.push(`→ ${known.action}`);
    }
  } else {
    if (codeNum) parts.push(`[Code ${codeNum}]`);
    if (err.userTitle) parts.push(err.userTitle);
    if (err.userMsg) parts.push(err.userMsg);
    if (err.details) parts.push(err.details);
    if (err.title && err.title !== err.message && !parts.includes(err.title)) parts.push(err.title);
    if (err.message && !parts.includes(err.message)) parts.push(err.message);
  }

  const result = parts.filter(Boolean).join(' — ');
  return result || 'Message delivery failed (Undeliverable)';
}
