// The emoji this browser picked most recently, for the picker's
// "Recently used" row. Per browser, in localStorage — a convenience,
// never something that has to survive: every access is guarded, and an
// empty list (private window, cleared storage) just hides the row.

const KEY = 'wacrm:recent-emoji';
const MAX = 24;

export function readRecentEmoji(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((e): e is string => typeof e === 'string').slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

export function rememberEmoji(emoji: string): void {
  try {
    const next = [emoji, ...readRecentEmoji().filter((e) => e !== emoji)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked or full: the row simply does not update.
  }
}
