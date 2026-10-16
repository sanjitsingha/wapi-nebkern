import { describe, expect, it } from "vitest";

import {
  OFFLINE_AFTER_MS,
  derivePresence,
  formatLastSeen,
  formatOnlineSince,
  presenceLabel,
  presenceSince,
  summarize,
} from "./presence";

// Fixed reference clock so every case is deterministic.
const NOW = new Date("2026-06-22T12:00:00.000Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("derivePresence", () => {
  it("returns the stored status for a fresh heartbeat", () => {
    expect(derivePresence("online", ago(1_000), NOW)).toBe("online");
    expect(derivePresence("away", ago(1_000), NOW)).toBe("away");
  });

  it("reads as offline when the heartbeat is stale", () => {
    expect(derivePresence("online", ago(OFFLINE_AFTER_MS + 1_000), NOW)).toBe(
      "offline",
    );
    // Stored 'away' goes stale to offline too (tab was closed while idle).
    expect(derivePresence("away", ago(OFFLINE_AFTER_MS + 1_000), NOW)).toBe(
      "offline",
    );
  });

  it("treats a missing row or timestamp as offline", () => {
    expect(derivePresence(undefined, null, NOW)).toBe("offline");
    expect(derivePresence("online", null, NOW)).toBe("offline");
    expect(derivePresence("online", "not-a-date", NOW)).toBe("offline");
  });

  it("stays online exactly at the threshold and flips just past it", () => {
    expect(derivePresence("online", ago(OFFLINE_AFTER_MS), NOW)).toBe("online");
    expect(derivePresence("online", ago(OFFLINE_AFTER_MS + 1), NOW)).toBe(
      "offline",
    );
  });
});

describe("formatLastSeen", () => {
  it("describes recent activity coarsely", () => {
    expect(formatLastSeen(ago(10_000), NOW)).toBe("just now");
    expect(formatLastSeen(ago(60_000), NOW)).toBe("1 minute ago");
    expect(formatLastSeen(ago(5 * 60_000), NOW)).toBe("5 minutes ago");
  });

  it("rolls up into hours and days", () => {
    expect(formatLastSeen(ago(60 * 60_000), NOW)).toBe("1 hour ago");
    expect(formatLastSeen(ago(2 * 60 * 60_000), NOW)).toBe("2 hours ago");
    expect(formatLastSeen(ago(24 * 60 * 60_000), NOW)).toBe("1 day ago");
    expect(formatLastSeen(ago(3 * 24 * 60 * 60_000), NOW)).toBe("3 days ago");
  });

  it("falls back gracefully on missing/invalid input", () => {
    expect(formatLastSeen(null, NOW)).toBe("a while ago");
    expect(formatLastSeen("nonsense", NOW)).toBe("a while ago");
  });
});

describe("presenceLabel", () => {
  it("labels each state for the tooltip", () => {
    expect(presenceLabel("online", ago(1_000), NOW)).toBe(
      "Online — active now",
    );
    expect(presenceLabel("away", ago(1_000), NOW)).toBe("Away — idle");
    expect(presenceLabel("offline", ago(2 * 60 * 60_000), NOW)).toBe(
      "Offline — last seen 2 hours ago",
    );
  });
});

describe("summarize", () => {
  it("counts each status", () => {
    expect(
      summarize(["online", "online", "online", "away", "offline"]),
    ).toEqual({ online: 3, away: 1, offline: 1 });
  });

  it("returns zeroes for an empty roster", () => {
    expect(summarize([])).toEqual({ online: 0, away: 0, offline: 0 });
  });
});

describe("formatOnlineSince", () => {
  // Local-time dates, so the assertions hold in any time zone.
  const now = new Date(2026, 9, 15, 16, 30).getTime();

  it("shows the time alone for a session that started today", () => {
    expect(formatOnlineSince(new Date(2026, 9, 15, 10, 42).toISOString(), now)).toBe("10:42 AM");
  });

  it("says yesterday for a session carried over from yesterday", () => {
    expect(formatOnlineSince(new Date(2026, 9, 14, 18, 5).toISOString(), now)).toBe(
      "yesterday, 6:05 PM",
    );
  });

  it("adds the date for anything older", () => {
    expect(formatOnlineSince(new Date(2026, 9, 12, 9, 0).toISOString(), now)).toBe(
      "12 Oct, 9:00 AM",
    );
  });
});

describe("presenceSince", () => {
  const now = new Date(2026, 9, 15, 16, 30).getTime();
  const since = new Date(2026, 9, 15, 10, 42).toISOString();
  const seen = new Date(now - 2 * 3_600_000).toISOString();

  it("says when an online teammate came on", () => {
    expect(
      presenceSince("online", { status: "online", last_seen_at: seen, online_since: since }, now),
    ).toBe("Online since 10:42 AM");
  });

  it("keeps the session start for someone away", () => {
    expect(
      presenceSince("away", { status: "away", last_seen_at: seen, online_since: since }, now),
    ).toBe("Away · online since 10:42 AM");
  });

  it("falls back to plain Online for a row from before online_since existed", () => {
    expect(presenceSince("online", { status: "online", last_seen_at: seen }, now)).toBe("Online");
  });

  it("gives last seen for someone offline", () => {
    expect(
      presenceSince("offline", { status: "online", last_seen_at: seen, online_since: since }, now),
    ).toBe("Last seen 2 hours ago");
  });

  it("says so for a teammate who has never signed in", () => {
    expect(presenceSince("offline", undefined, now)).toBe("Not signed in yet");
  });
});
