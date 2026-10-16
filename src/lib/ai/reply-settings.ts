/**
 * Maya's reply settings — what Maya → Configuration edits and the
 * auto-reply engine obeys. Pure and dependency-free so the browser can
 * load it: the editor uses the same limits and the same open/closed
 * check as the server.
 */

// ------------------------------------------------------------
// Activation rules
// ------------------------------------------------------------

/** Offered in the editor when an account hasn't written its own rules. */
export const DEFAULT_ACTIVATION_PROMPT = `You decide whether the business's AI agent should reply to the customer's latest message.
Reply if the message does at least one of these:
- asks a question, or for information, clarification or help
- raises a problem, complaint or concern
- asks the business to do something
- is clearly waiting for an answer from the business
Don't reply to a message that only acknowledges, thanks, greets back or closes the conversation, such as "ok", "thanks" or "👍".`;

/** The longest rules the editor accepts. */
export const ACTIVATION_PROMPT_MAX_CHARS = 4000;

// ------------------------------------------------------------
// Timing
// ------------------------------------------------------------

/**
 * Seconds Maya waits after a customer's last message before replying —
 * time for a teammate to answer first, and for a customer typing
 * several short messages to finish. 8 is the quiet period she used
 * before this was a setting.
 */
export const RESPONSE_DELAY = { min: 3, max: 6000, default: 8 } as const;

/** Seconds Maya stays quiet after a teammate replies. 0 = no pause. */
export const SNOOZE = { min: 0, max: 6000, default: 0 } as const;

/** A whole number of seconds within `range`, or null. */
export function parseSeconds(value: unknown, range: { min: number; max: number }): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n)) return null;
  return n >= range.min && n <= range.max ? n : null;
}

// ------------------------------------------------------------
// Operating hours
// ------------------------------------------------------------

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** One open stretch in a day, as 24-hour "HH:MM" local to `timezone`. */
export interface DayHours {
  start: string;
  end: string;
}

export interface OperatingHours {
  /** Off keeps the schedule but ignores it: Maya answers at any hour. */
  enabled: boolean;
  /** IANA zone the times are in, e.g. "Asia/Kolkata". */
  timezone: string;
  /** null = closed all day. */
  days: Record<Weekday, DayHours | null>;
}

/** Mon–Sat 09:00–18:00, Sunday closed — the editor's starting point. */
export function defaultOperatingHours(timezone: string): OperatingHours {
  const open: DayHours = { start: '09:00', end: '18:00' };
  return {
    enabled: false,
    timezone,
    days: { mon: open, tue: open, wed: open, thu: open, fri: open, sat: open, sun: null },
  };
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * A stored or submitted schedule, checked: a real timezone, every day
 * present, and each open day's end after its start. null if any of it
 * is wrong.
 */
export function parseOperatingHours(raw: unknown): OperatingHours | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<OperatingHours>;
  if (typeof value.enabled !== 'boolean') return null;
  if (typeof value.timezone !== 'string' || !isValidTimezone(value.timezone)) return null;
  if (!value.days || typeof value.days !== 'object') return null;

  const days = {} as Record<Weekday, DayHours | null>;
  for (const day of WEEKDAYS) {
    const hours = (value.days as Record<string, unknown>)[day];
    if (hours === null) {
      days[day] = null;
      continue;
    }
    const { start, end } = (hours ?? {}) as Partial<DayHours>;
    if (typeof start !== 'string' || typeof end !== 'string') return null;
    if (!HHMM.test(start) || !HHMM.test(end) || toMinutes(end) <= toMinutes(start)) return null;
    days[day] = { start, end };
  }
  return { enabled: value.enabled, timezone: value.timezone, days };
}

/**
 * Whether Maya may answer right now. No schedule, or a schedule that's
 * switched off, means always. Fails open on anything unreadable, so a
 * bad setting can't silence her.
 */
export function isWithinOperatingHours(hours: OperatingHours | null | undefined, now = new Date()): boolean {
  if (!hours?.enabled) return true;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: hours.timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const day = part('weekday').toLowerCase().slice(0, 3) as Weekday;
    if (!WEEKDAYS.includes(day)) return true;
    const open = hours.days[day];
    if (!open) return false;
    const minutes = Number(part('hour')) * 60 + Number(part('minute'));
    return minutes >= toMinutes(open.start) && minutes < toMinutes(open.end);
  } catch {
    return true;
  }
}
