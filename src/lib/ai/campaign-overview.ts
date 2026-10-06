import { META_ERROR_CODE_MAP, extractErrorCode } from '@/lib/whatsapp/errors';
import type {
  CampaignAiOverview,
  CampaignOverviewBasis,
  MessageTemplate,
} from '@/types';
import { AiError, type ChatMessage } from './types';
import { STRUCTURED_MAX_OUTPUT_TOKENS, STRUCTURED_TIMEOUT_MS } from './defaults';

// ============================================================
// The AI overview on /campaigns/[id].
//
// The model never sees the database. This file boils one campaign down
// to a small block of facts — the funnel, the rates the page shows,
// read/reply timing, grouped failure reasons with Meta's own meaning
// attached, and the template that was sent — and asks for a short JSON
// verdict back: a headline, one paragraph on how it went, suggestions. Everything here is pure, so the numbers the model is
// handed can be tested without a provider key.
//
// The facts are the whole defence against made-up numbers: the prompt
// forbids anything not in them, and the caveats (still sending, sent an
// hour ago, 30 deliveries) are computed here rather than left for the
// model to notice.
// ============================================================

export interface OverviewBroadcast {
  name: string;
  status: string;
  template_name: string;
  template_language: string;
  created_at: string;
  scheduled_at?: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  replied_count: number;
  failed_count: number;
}

export interface OverviewRecipient {
  status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  error_message: string | null;
}

export type OverviewTemplate = Pick<
  MessageTemplate,
  | 'category'
  | 'header_type'
  | 'header_content'
  | 'body_text'
  | 'footer_text'
  | 'buttons'
>;

/** Below this many deliveries, rates swing on a handful of people. */
const SMALL_SAMPLE = 50;
/** Reads and replies keep arriving for about a day after a send. */
const SETTLING_HOURS = 24;
const MAX_FAILURE_GROUPS = 8;
const MAX_BODY_CHARS = 1500;

/**
 * The counters as one consistent funnel.
 *
 * Same ladder as the campaign page: the counters are trigger-maintained
 * per webhook and can be briefly out of order mid-send (a read receipt
 * before its delivery receipt), so each stage is capped by the one
 * before it. The model then never sees "read 105% of delivered".
 */
export function basisFromBroadcast(b: OverviewBroadcast): CampaignOverviewBasis {
  const clamp = (n: number, max: number) => Math.min(Math.max(0, n || 0), max);
  const total = Math.max(0, b.total_recipients || 0);
  const sent = clamp(b.sent_count, total);
  const delivered = clamp(b.delivered_count, total);
  const read = clamp(b.read_count, delivered);
  const replied = clamp(b.replied_count, read);
  const failed = clamp(b.failed_count, total - delivered);
  return { total, sent, delivered, read, replied, failed };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** A percentage to one decimal, or null when there is nothing to divide by. */
function pct(num: number, den: number): number | null {
  return den > 0 ? round1(Math.min(100, (num / den) * 100)) : null;
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Minutes from send to `field`, for every recipient that has both. */
function delaysMinutes(
  rows: OverviewRecipient[],
  field: 'read_at' | 'replied_at',
): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const sent = ms(r.sent_at);
    const at = ms(r[field]);
    if (sent != null && at != null && at >= sent) out.push((at - sent) / 60_000);
  }
  return out;
}

interface FailureGroup {
  reason: string;
  count: number;
  /** What Meta's code means, when the code is one we know. */
  meaning?: string;
  fix?: string;
}

/**
 * Failures grouped by cause. A known Meta code groups by code — the
 * stored text varies by row (it can carry the phone number or a
 * parameter) but the cause does not — and brings its plain-language
 * explanation and fix along, so the model explains the real cause
 * instead of guessing at one.
 */
function groupFailures(rows: OverviewRecipient[]): FailureGroup[] {
  const groups = new Map<string, FailureGroup>();
  for (const r of rows) {
    if (r.status !== 'failed') continue;
    const code = extractErrorCode(r.error_message);
    const known = code != null ? META_ERROR_CODE_MAP[code] : undefined;
    const key = known
      ? `code:${code}`
      : (r.error_message ?? '').split('\n')[0].trim() || 'Unknown error';
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    groups.set(
      key,
      known
        ? {
            reason: `[Code ${code}] ${known.title}`,
            count: 1,
            meaning: known.explanation,
            fix: known.action,
          }
        : { reason: key.slice(0, 200), count: 1 },
    );
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_FAILURE_GROUPS);
}

function describeTemplate(t: OverviewTemplate | null) {
  if (!t) return null;
  const body = t.body_text ?? '';
  return {
    category: t.category,
    header:
      t.header_type === 'text'
        ? `text: ${t.header_content ?? ''}`
        : (t.header_type ?? null),
    body:
      body.length > MAX_BODY_CHARS ? `${body.slice(0, MAX_BODY_CHARS)}…` : body,
    footer: t.footer_text || null,
    buttons: (t.buttons ?? []).map((b) => `${b.type}: ${b.text}`),
  };
}

export interface CampaignFactsInput {
  broadcast: OverviewBroadcast;
  /** Recipient rows for timing and failure reasons. May be a capped
   *  subset on a very large campaign — the counts always come from the
   *  campaign's own counters, never from this list. */
  recipients: OverviewRecipient[];
  template: OverviewTemplate | null;
  /** True when `recipients` stopped short of the full list. */
  recipientsTruncated?: boolean;
  now?: Date;
}

/** Everything the model is allowed to know about the campaign. */
export function buildCampaignFacts(input: CampaignFactsInput) {
  const { broadcast, recipients, template, recipientsTruncated = false } = input;
  const now = (input.now ?? new Date()).getTime();
  const basis = basisFromBroadcast(broadcast);

  const sendTimes = recipients
    .map((r) => ms(r.sent_at))
    .filter((t): t is number => t != null);
  const firstSend = sendTimes.length ? Math.min(...sendTimes) : null;
  const lastSend = sendTimes.length ? Math.max(...sendTimes) : null;
  const hoursSinceLastSend =
    lastSend != null ? round1((now - lastSend) / 3_600_000) : null;

  const readDelays = delaysMinutes(recipients, 'read_at');
  const replyDelays = delaysMinutes(recipients, 'replied_at');
  const medianRead = median(readDelays);
  const medianReply = median(replyDelays);

  const caveats: string[] = [];
  if (broadcast.status === 'sending') {
    caveats.push('The campaign is still sending; every number is still moving.');
  } else if (hoursSinceLastSend != null && hoursSinceLastSend < SETTLING_HOURS) {
    caveats.push(
      `The last message went out ${hoursSinceLastSend} hours ago; reads and replies are probably still coming in.`,
    );
  }
  if (basis.delivered < SMALL_SAMPLE) {
    caveats.push(
      `Small sample: only ${basis.delivered} messages were delivered, so the rates can swing on a few people.`,
    );
  }
  if (recipientsTruncated) {
    caveats.push(
      `Timing and failure details come from the first ${recipients.length.toLocaleString('en-US')} recipients; the counts cover everyone.`,
    );
  }

  return {
    campaign: {
      name: broadcast.name,
      status: broadcast.status,
      template_name: broadcast.template_name,
      template_language: broadcast.template_language,
      created_at_utc: broadcast.created_at,
      scheduled_for_utc: broadcast.scheduled_at ?? null,
    },
    template: describeTemplate(template),
    counts: {
      recipients: basis.total,
      sent: basis.sent,
      delivered: basis.delivered,
      read: basis.read,
      replied: basis.replied,
      failed: basis.failed,
      not_yet_delivered: Math.max(0, basis.total - basis.delivered - basis.failed),
    },
    // The same rates, with the same denominators, as the tiles on the
    // campaign page — so the overview and the page agree.
    rates_pct: {
      delivery_of_sent: pct(basis.delivered, Math.max(basis.sent, basis.delivered)),
      read_of_delivered: pct(basis.read, basis.delivered),
      reply_of_delivered: pct(basis.replied, basis.delivered),
      reply_of_read: pct(basis.replied, basis.read),
      failure_of_recipients: pct(basis.failed, basis.total),
    },
    timing: {
      first_send_utc: firstSend != null ? new Date(firstSend).toISOString() : null,
      last_send_utc: lastSend != null ? new Date(lastSend).toISOString() : null,
      hours_since_last_send: hoursSinceLastSend,
      median_minutes_send_to_read: medianRead != null ? round1(medianRead) : null,
      reads_within_1h_pct: pct(
        readDelays.filter((m) => m <= 60).length,
        readDelays.length,
      ),
      median_minutes_send_to_reply: medianReply != null ? round1(medianReply) : null,
    },
    failure_reasons: groupFailures(recipients),
    caveats,
  };
}

export type CampaignFacts = ReturnType<typeof buildCampaignFacts>;

export const OVERVIEW_SYSTEM_PROMPT = `You review the results of one WhatsApp broadcast campaign for the business that sent it through Instant, a WhatsApp Business API CRM. You write a short, plain-language overview for the owner: how it went, what worked, what did not, and what to try next.

Rules:
- Use only the facts you are given. Never invent a number, and do not quote industry benchmarks or averages.
- Quote the campaign's own figures where they help, e.g. "62% of delivered messages were read".
- Respect the caveats. If results are early or the sample is small, say so and keep conclusions tentative.
- For failures, explain the cause in plain words, using the meaning and fix given with each reason.
- Suggestions must be concrete and doable: who to follow up with (for example, people who read but did not reply), what to change in the template (wording, the call to action, buttons), when to send, which numbers to clean up. Instant has contacts, tags, segments and lists, templates, campaigns and automations; suggest them where they fit.
- Do not repeat in the suggestions what the summary already said; the summary describes, the suggestions act.
- Write for a busy owner: short sentences, no jargon, no markdown, no emoji.

Reply with JSON only, with no code fence, in exactly this shape:
{"headline": "...", "summary": "...", "suggestions": ["..."]}

- headline: one sentence, the overall verdict.
- summary: one paragraph of 3 to 5 sentences covering what worked and what did not, together, with the figures that show it. Lead with what matters most, good or bad.
- suggestions: 2 to 4 items, each one or two sentences.`;

/** See STRUCTURED_MAX_OUTPUT_TOKENS — an overview is ~500 tokens of
 *  answer after however long a reasoning model thinks. */
export const OVERVIEW_MAX_OUTPUT_TOKENS = STRUCTURED_MAX_OUTPUT_TOKENS;
/** See STRUCTURED_TIMEOUT_MS. */
export const OVERVIEW_TIMEOUT_MS = STRUCTURED_TIMEOUT_MS;

export function buildOverviewMessages(facts: CampaignFacts): ChatMessage[] {
  return [
    {
      role: 'user',
      content: `Here are the campaign's results.\n\n${JSON.stringify(facts, null, 2)}`,
    },
  ];
}

const MAX_HEADLINE_CHARS = 300;
const MAX_SUMMARY_CHARS = 1200;
const MAX_ITEM_CHARS = 400;
const MAX_ITEMS = 5;

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const text = value
    .replace(/\s+/g, ' ')
    // A model that ignores "no markdown" still shouldn't leave a stray
    // bullet or bold marker in the UI.
    .replace(/^[-*•]\s+/, '')
    .replace(/\*\*/g, '')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => cleanText(v, MAX_ITEM_CHARS))
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
}

export type OverviewSections = Pick<
  CampaignAiOverview,
  'headline' | 'summary' | 'suggestions'
>;

/**
 * The model's reply as headline, summary and suggestions.
 *
 * Tolerant of the usual drift — a ```json fence, prose around the
 * object, a model still answering in the old went_well / went_wrong
 * lists — and strict about the one thing that makes the result
 * unusable: no readable object, or no headline.
 */
export function parseOverview(raw: string): OverviewSections {
  const unreadable = () =>
    new AiError('The AI returned an overview we could not read. Try again.', {
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
  const headline = cleanText(o.headline, MAX_HEADLINE_CHARS);
  if (!headline) throw unreadable();

  // A model that ignores the new shape and lists went_well / went_wrong
  // anyway still gets read: its items run on as the paragraph.
  const summary =
    cleanText(o.summary, MAX_SUMMARY_CHARS) ||
    cleanText(
      [
        ...cleanList(o.went_well ?? o.wentWell),
        ...cleanList(o.went_wrong ?? o.wentWrong),
      ].join(' '),
      MAX_SUMMARY_CHARS,
    );

  return {
    headline,
    summary,
    suggestions: cleanList(o.suggestions),
  };
}
