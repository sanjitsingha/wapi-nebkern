import type { MentionableMember } from '@/types';

// ============================================================
// @mentions in a contact's team thread.
//
// A mention is stored in the message body as `@[Full Name](user-id)`
// and rendered as `@Full Name`. The id is in the text rather than
// resolved from the name at read time for two reasons: names are not
// unique on an account, and a member who is renamed — or who leaves —
// must not silently re-point an old mention at somebody else.
//
// Parsing is the security boundary. The notification rows are written
// from whatever this returns, so it decides who gets told. Everything
// it emits is checked against the account's member list before a row is
// written; see `resolveMentions`.
// ============================================================

/**
 * `@[Name](uuid)`.
 *
 * The name run excludes `]` so a bracket in a display name cannot end
 * the token early, and the id is matched as a UUID rather than as
 * "anything in parens" — a loose match here is what would let a body
 * carry a crafted target.
 */
const MENTION_RE =
  /@\[([^\]]{1,120})\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/g;

export interface ParsedMention {
  /** The name as written when the mention was made. */
  label: string;
  /** auth.users.id of the person tagged. */
  userId: string;
}

/** Every mention token in a body, in order, deduplicated by user. */
export function parseMentions(body: string): ParsedMention[] {
  const seen = new Set<string>();
  const out: ParsedMention[] = [];
  for (const m of body.matchAll(MENTION_RE)) {
    const userId = m[2].toLowerCase();
    if (seen.has(userId)) continue;
    seen.add(userId);
    out.push({ label: m[1], userId });
  }
  return out;
}

/**
 * Narrow a parsed list to people who are actually on this account, and
 * drop the author.
 *
 * The client composes the token, so the id in a body is user input.
 * Without this check a member could hand-write a token naming someone
 * from another tenant and generate a notification pointing at a contact
 * they cannot see. Notifying yourself is filtered separately — it is
 * not an attack, just noise.
 */
export function resolveMentions(
  body: string,
  members: MentionableMember[],
  authorId: string,
): string[] {
  const allowed = new Set(members.map((m) => m.user_id.toLowerCase()));
  return parseMentions(body)
    .map((m) => m.userId)
    .filter((id) => allowed.has(id) && id !== authorId.toLowerCase());
}

/** Turn the stored form into what a person reads: `@Priya Raman`. */
export function mentionPlainText(body: string): string {
  return body.replace(MENTION_RE, (_m, label: string) => `@${label}`);
}

/** One segment of a body, for rendering. */
export type BodySegment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; label: string; userId: string };

/**
 * Split a body into text and mention runs so a component can style the
 * mentions without using `dangerouslySetInnerHTML` — the body is
 * user-written, and it is never turned into markup anywhere.
 */
export function segmentBody(body: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let cursor = 0;

  for (const m of body.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    if (start > cursor) {
      segments.push({ kind: 'text', text: body.slice(cursor, start) });
    }
    segments.push({
      kind: 'mention',
      label: m[1],
      userId: m[2].toLowerCase(),
    });
    cursor = start + m[0].length;
  }

  if (cursor < body.length) {
    segments.push({ kind: 'text', text: body.slice(cursor) });
  }
  return segments;
}

/** Build the stored token for a member. */
export function mentionToken(member: MentionableMember): string {
  // A `]` in a display name would terminate the label run and corrupt
  // every mention after it in the body, so it is stripped rather than
  // escaped — no name needs one, and a broken token is unrecoverable.
  const safeLabel = member.full_name.replace(/[[\]()]/g, '').trim();
  return `@[${safeLabel || 'member'}](${member.user_id})`;
}

/**
 * Find the `@…` the caret is currently inside, for the picker.
 *
 * Returns null unless the caret sits in a run that began with `@` on a
 * word boundary and has not yet hit whitespace — otherwise every `@` in
 * an email address would open the member list.
 */
export function activeMentionQuery(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf('@');
  if (at === -1) return null;

  // Must start a word: preceded by nothing, whitespace, or an opening
  // bracket. `priya@example.com` therefore does not trigger.
  const before = at === 0 ? '' : upto[at - 1];
  if (before && !/[\s(]/.test(before)) return null;

  const query = upto.slice(at + 1);
  // A completed token or a space ends the run.
  if (/[\s\]]/.test(query)) return null;
  if (query.length > 40) return null;

  return { query, start: at };
}
