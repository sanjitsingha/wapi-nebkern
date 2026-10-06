import type { MessageTemplate, TemplateButton } from '@/types';
import { TEMPLATE_LIMITS } from '@/lib/whatsapp/template-validators';
import { AiError, type ChatMessage } from './types';

// ============================================================
// "Write with Maya" on /templates/new.
//
// The user describes the message; the account's own AI provider answers
// with a whole template as JSON — name, category, language, header,
// body with {{n}} variables and sample values, footer, buttons — and
// the builder fills its form from it for the user to review.
//
// The prompt states Meta's rules, but a model will still slip, so
// `parseTemplateDraft` repairs everything that can be repaired
// mechanically (variable numbering, an emoji in a text header, a
// 30-character button, quick replies after a link) rather than handing
// the form something the submit check will reject. The two things it
// will never do are invent a link or a phone number: a button that
// needs one and wasn't given one comes back blank, with a note saying
// what to fill in.
// ============================================================

export type DraftHeaderFormat = 'none' | 'text' | 'image' | 'video' | 'document';

/** The template form's fields that Maya fills. */
export interface TemplateDraft {
  name: string;
  category: MessageTemplate['category'];
  language: string;
  header_format: DraftHeaderFormat;
  header_content: string;
  header_sample: string;
  body_text: string;
  body_samples: string[];
  footer_text: string;
  buttons: TemplateButton[];
}

export interface TemplateDraftResult {
  draft: TemplateDraft;
  /** What the user still has to do before submitting — a link Maya
   *  wasn't given, a header image to attach. */
  notes: string[];
}

/** Long enough for a detailed brief, short enough to stay a brief. */
export const MAX_PROMPT_CHARS = 2000;

export const TEMPLATE_SYSTEM_PROMPT = `You write WhatsApp Business message templates for submission to Meta. The user describes the message they want; you write the whole template.

Follow Meta's rules exactly:
- name: lowercase letters, digits and underscores only; short and descriptive, e.g. diwali_sale_offer.
- category: "Marketing" for promotions, offers, announcements, newsletters and re-engagement. "Utility" only for an update about something the customer already started (an order, a booking, a payment, an account) with no promotional wording at all; Meta reclassifies a Utility template that sells. "Authentication" only for one-time passcodes.
- language: the Meta code for the language you write in (en, en_US, hi, mr, ta, es, pt_BR…). Write in the language the user asks for; if they don't say, use the default code you are given.
- header (optional): {"type":"none"}, or {"type":"text","text":"..."} with at most 60 characters, no emoji, no asterisks, no line breaks and at most one variable, {{1}}. Use {"type":"image"}, "video" or "document" only if the user asks for a picture, video or file; you cannot attach it, they will.
- body (required): at most 1024 characters, ideally under 550. Clear, warm and specific. WhatsApp formatting (*bold*, _italic_) and a few emoji are fine in the body.
- Variables: {{1}}, {{2}}… for details that change per customer (name, order number, date, amount, link code). Number them in the order they appear, starting at 1 with no gaps. Never start or end the body with a variable, never put two variables side by side, and keep plenty of fixed words around them.
- If the message needs a detail the user did not give (a price, a date, a discount, a deadline), make it a variable. Never invent it.
- body_samples: one realistic example value per body variable, in order. header_sample: an example for the header's {{1}}, if it has one.
- footer (optional): at most 60 characters, no variables. For Marketing, a short opt-out line such as "Reply STOP to unsubscribe" is good practice.
- buttons (optional): at most 10 in total. Quick replies come first. At most 2 URL buttons, 1 phone button and 1 copy-code button. Button text at most 25 characters.
  - {"type":"QUICK_REPLY","text":"..."}
  - {"type":"URL","text":"...","url":"https://...","example":"..."}: a URL may end in one variable, e.g. https://shop.com/track/{{1}}, and then "example" is a sample value for it.
  - {"type":"PHONE_NUMBER","text":"...","phone_number":"+91..."}
  - {"type":"COPY_CODE","text":"Copy code","example":"CODE20"}: for a coupon code, at most 15 characters.
- Use only links and phone numbers the user gave you. If a button needs one they did not give, set "url" or "phone_number" to "" and they will fill it in. Never make one up.

Reply with JSON only, with no code fence, in this shape:
{"name":"...","category":"Marketing","language":"en","header":{"type":"none"},"header_sample":"","body":"...","body_samples":["..."],"footer":"","buttons":[]}`;

export function buildTemplateMessages(prompt: string, language: string): ChatMessage[] {
  return [
    {
      role: 'user',
      content: `Write a WhatsApp template for this request:\n\n${prompt}\n\nDefault language code if the request doesn't say: ${language}`,
    },
  ];
}

// ── Repair ──────────────────────────────────────────────────────────

const VAR_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;
const EMOJI_RE = /[\p{Extended_Pictographic}️‍]/gu;
const LANGUAGE_RE = /^[a-z]{2,3}(_[A-Z]{2})?$/;
const HEADER_FORMATS: DraftHeaderFormat[] = ['none', 'text', 'image', 'video', 'document'];
const MAX_NAME_CHARS = 60;
const MAX_COUPON_CHARS = 15;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Cut at the last word boundary that fits, so nothing ends mid-word. */
function cut(s: string, max: number): string {
  if (s.length <= max) return s;
  const head = s.slice(0, max);
  const space = head.lastIndexOf(' ');
  return (space > max * 0.6 ? head.slice(0, space) : head).trimEnd();
}

function cleanName(raw: string, fallbackFrom: string): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, MAX_NAME_CHARS)
      .replace(/_+$/, '');
  return (
    slug(raw) ||
    slug(fallbackFrom.split(/\s+/).slice(0, 4).join(' ')) ||
    'maya_template'
  );
}

function cleanCategory(raw: string): MessageTemplate['category'] {
  const c = raw.trim().toLowerCase();
  if (c === 'utility') return 'Utility';
  if (c === 'authentication') return 'Authentication';
  return 'Marketing';
}

/**
 * Renumber variables 1..n in order of first appearance.
 *
 * Covers the ways a model gets this wrong: gaps ({{1}} {{3}}), starting
 * at 2, reusing out of order, or named placeholders ({{name}}) when the
 * app sends positional ones. Returns the original keys in their new
 * order, so the sample values can follow their variables.
 */
function renumber(text: string): { text: string; keys: string[] } {
  const keys: string[] = [];
  const out = text.replace(VAR_RE, (_, key: string) => {
    let i = keys.indexOf(key);
    if (i === -1) {
      keys.push(key);
      i = keys.length - 1;
    }
    return `{{${i + 1}}}`;
  });
  return { text: out, keys };
}

/** The sample for an original variable key, from an array (by number)
 *  or an object (by name). */
function sampleFor(samples: unknown, key: string): string {
  if (Array.isArray(samples)) {
    const n = Number(key);
    return Number.isInteger(n) && n >= 1 ? oneLine(str(samples[n - 1])) : '';
  }
  if (samples && typeof samples === 'object') {
    return oneLine(str((samples as Record<string, unknown>)[key]));
  }
  return '';
}

function cleanButtons(raw: unknown, notes: string[]): TemplateButton[] {
  if (!Array.isArray(raw)) return [];
  const limits: Record<TemplateButton['type'], number> = {
    QUICK_REPLY: TEMPLATE_LIMITS.maxButtonsTotal,
    URL: TEMPLATE_LIMITS.maxUrlButtons,
    PHONE_NUMBER: TEMPLATE_LIMITS.maxPhoneButtons,
    COPY_CODE: TEMPLATE_LIMITS.maxCopyCodeButtons,
  };
  const used: Record<TemplateButton['type'], number> = {
    QUICK_REPLY: 0,
    URL: 0,
    PHONE_NUMBER: 0,
    COPY_CODE: 0,
  };
  const out: TemplateButton[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const b = item as Record<string, unknown>;
    const type = str(b.type).toUpperCase().replace(/[\s-]/g, '_');
    const text = cut(oneLine(str(b.text)), TEMPLATE_LIMITS.buttonTextMaxLength);
    if (!text) continue;
    if (!(type in used)) continue;
    const t = type as TemplateButton['type'];
    if (used[t] >= limits[t]) continue;

    if (t === 'QUICK_REPLY') {
      out.push({ type: t, text });
    } else if (t === 'URL') {
      out.push(cleanUrlButton(text, str(b.url), str(b.example), notes));
    } else if (t === 'PHONE_NUMBER') {
      const phone = str(b.phone_number).replace(/[^\d+]/g, '');
      const digits = phone.replace(/\D/g, '').length;
      const valid = digits >= 8 && digits <= 15;
      if (!valid) notes.push(`Add the phone number for the “${text}” button.`);
      out.push({ type: t, text, phone_number: valid ? phone : '' });
    } else {
      const code = oneLine(str(b.example)).replace(/\s/g, '').slice(0, MAX_COUPON_CHARS);
      if (!code) notes.push(`Add the coupon code for the “${text}” button.`);
      out.push({ type: t, text, example: code });
    }
    used[t] += 1;
    if (out.length >= TEMPLATE_LIMITS.maxButtonsTotal) break;
  }

  // Meta: quick replies in one block at the start. A stable partition
  // keeps the model's order within each group.
  return [
    ...out.filter((b) => b.type === 'QUICK_REPLY'),
    ...out.filter((b) => b.type !== 'QUICK_REPLY'),
  ];
}

function cleanUrlButton(
  text: string,
  rawUrl: string,
  rawExample: string,
  notes: string[],
): TemplateButton {
  let url = rawUrl.trim();
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;

  // At most one variable, always {{1}}, always last (Meta).
  const vars = url.match(VAR_RE) ?? [];
  if (vars.length > 0) {
    url = url.replace(VAR_RE, '');
    url = `${url}{{1}}`;
  }

  if (url) {
    try {
      const parsed = new URL(url.replace('{{1}}', 'x'));
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') url = '';
    } catch {
      url = '';
    }
  }
  if (!url) {
    notes.push(`Add the link for the “${text}” button.`);
    return { type: 'URL', text, url: '' };
  }

  if (url.includes('{{1}}')) {
    const example = oneLine(rawExample);
    if (!example) notes.push(`Add an example value for the “${text}” button's link.`);
    return { type: 'URL', text, url, example };
  }
  return { type: 'URL', text, url };
}

/**
 * The model's reply as a template the form can take.
 *
 * Throws only when there is nothing to work with — no JSON object, or
 * no body. Everything else is repaired, and anything the user must
 * still supply is listed in `notes`.
 */
export function parseTemplateDraft(
  raw: string,
  opts: { prompt: string; defaultLanguage: string },
): TemplateDraftResult {
  const unreadable = () =>
    new AiError('Maya returned a template we could not read. Try again.', {
      code: 'bad_output',
      status: 502,
    });

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw unreadable();
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw unreadable();
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw unreadable();
  const o = data as Record<string, unknown>;
  const notes: string[] = [];

  // Body: cut to Meta's limit first, so a variable lost to the cut also
  // loses its sample, then number what's left.
  const bodyRaw = cut(str(o.body ?? o.body_text).trim(), TEMPLATE_LIMITS.bodyMaxLength)
    // A cut can strand half a placeholder ("{{2" with no closing braces).
    .replace(/\{\{[^}]*$/, '')
    .trimEnd();
  if (!bodyRaw) throw unreadable();
  const body = renumber(bodyRaw);
  const bodySamples = body.keys.map((k) => sampleFor(o.body_samples, k) || 'Sample');
  if (/^\{\{\d+\}\}/.test(body.text) || /\{\{\d+\}\}[.!?]?$/.test(body.text)) {
    notes.push('The message starts or ends with a variable; Meta may reject that. Add a word or two around it.');
  }

  // Header.
  const h = (o.header && typeof o.header === 'object' ? o.header : {}) as Record<string, unknown>;
  let headerFormat = str(h.type ?? o.header_type).toLowerCase() as DraftHeaderFormat;
  if (!HEADER_FORMATS.includes(headerFormat)) headerFormat = 'none';
  let headerContent = '';
  let headerSample = '';
  if (headerFormat === 'text') {
    const cleaned = oneLine(
      str(h.text ?? h.content ?? o.header_text).replace(/\*/g, '').replace(EMOJI_RE, ''),
    );
    // One variable at most, and it is {{1}}: keep the first, drop the rest.
    let seen = false;
    headerContent = cut(
      oneLine(
        cleaned.replace(VAR_RE, () => {
          if (seen) return '';
          seen = true;
          return '{{1}}';
        }),
      ),
      TEMPLATE_LIMITS.headerTextMaxLength,
    ).replace(/\{\{[^}]*$/, '').trim();
    if (!headerContent) headerFormat = 'none';
    else if (headerContent.includes('{{1}}')) {
      headerSample = oneLine(str(o.header_sample)) || 'Sample';
    }
  } else if (headerFormat !== 'none') {
    notes.push(`Attach the header ${headerFormat}; Maya can't add files.`);
  }

  const footer = cut(
    oneLine(str(o.footer ?? o.footer_text).replace(VAR_RE, '')),
    TEMPLATE_LIMITS.footerMaxLength,
  );

  const languageRaw = str(o.language).trim();
  const category = cleanCategory(str(o.category));
  if (category === 'Authentication') {
    notes.push('Meta writes Authentication templates itself from your app name, so only the category and button carry over.');
  }

  return {
    draft: {
      name: cleanName(str(o.name), opts.prompt),
      category,
      language: LANGUAGE_RE.test(languageRaw) ? languageRaw : opts.defaultLanguage,
      header_format: headerFormat,
      header_content: headerContent,
      header_sample: headerSample,
      body_text: body.text,
      body_samples: bodySamples,
      footer_text: footer,
      buttons: cleanButtons(o.buttons, notes),
    },
    notes,
  };
}
