import { describe, expect, it } from "vitest";
import {
  broadcastStatusConfig,
  getBroadcastStatus,
  getRecipientStatus,
  recipientStatusConfig,
} from "./broadcast-status";

describe("getBroadcastStatus", () => {
  it("returns the matching config for known statuses", () => {
    expect(getBroadcastStatus("sending")).toBe(broadcastStatusConfig.sending);
    expect(getBroadcastStatus("sent")).toBe(broadcastStatusConfig.sent);
    expect(getBroadcastStatus("failed")).toBe(broadcastStatusConfig.failed);
  });

  it("flags `sending` as a live/pulsing state", () => {
    expect(getBroadcastStatus("sending").pulse).toBe(true);
    expect(getBroadcastStatus("sent").pulse).toBeFalsy();
  });

  it("falls back to draft on an unknown status string", () => {
    expect(getBroadcastStatus("not-a-real-status")).toBe(
      broadcastStatusConfig.draft,
    );
    expect(getBroadcastStatus("")).toBe(broadcastStatusConfig.draft);
  });

  it("each variant has the fill/text/border class triple", () => {
    // The palette is light-first, so assert the *base* utility of each
    // kind rather than a specific opacity: shades (bg-red-50), theme
    // tokens (bg-muted, text-muted-foreground) and translucent tokens
    // (bg-primary/10) are all legal. Leading `(^|\s)` keeps a `dark:`
    // variant from satisfying the check on its own — every status must
    // read correctly on the default light surface.
    const utility = (prefix: string) =>
      new RegExp(`(^|\\s)${prefix}-[a-z]+(-(?:[a-z]+|\\d+))*(/\\d+)?(\\s|$)`);

    for (const v of Object.values(broadcastStatusConfig)) {
      expect(v.classes).toMatch(utility("bg"));
      expect(v.classes).toMatch(utility("text"));
      expect(v.classes).toMatch(utility("border"));
    }
  });
});

describe("getRecipientStatus", () => {
  it("returns the matching config for known statuses", () => {
    expect(getRecipientStatus("delivered")).toBe(
      recipientStatusConfig.delivered,
    );
    expect(getRecipientStatus("read")).toBe(recipientStatusConfig.read);
  });

  it("falls back to pending on an unknown status string", () => {
    expect(getRecipientStatus("???")).toBe(recipientStatusConfig.pending);
  });
});
