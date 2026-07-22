import { describe, expect, it } from "vitest";
import {
  UNLIMITED_ENTITLEMENTS,
  atLimit,
  parsePlanLimits,
  sanitizeLimitsInput,
} from "./entitlements";

describe("parsePlanLimits", () => {
  it("fails open for junk", () => {
    expect(parsePlanLimits(null)).toEqual(UNLIMITED_ENTITLEMENTS);
    expect(parsePlanLimits([])).toEqual(UNLIMITED_ENTITLEMENTS);
    expect(parsePlanLimits("nope")).toEqual(UNLIMITED_ENTITLEMENTS);
  });

  it("reads the three new counts", () => {
    const ent = parsePlanLimits({
      max_automations: 5,
      max_campaigns: 20,
      max_flows: 3,
    });
    expect(ent.maxAutomations).toBe(5);
    expect(ent.maxCampaigns).toBe(20);
    expect(ent.maxFlows).toBe(3);
  });

  // The whole reason no migration backfills these: a plan saved before
  // the keys existed must stay uncapped, not silently drop to zero.
  it("treats absent counts as unlimited, not zero", () => {
    const ent = parsePlanLimits({ max_users: 3, allow_flows: true });
    expect(ent.maxAutomations).toBeNull();
    expect(ent.maxCampaigns).toBeNull();
    expect(ent.maxFlows).toBeNull();
  });

  it("treats explicit null as unlimited", () => {
    const ent = parsePlanLimits({ max_campaigns: null });
    expect(ent.maxCampaigns).toBeNull();
  });

  it("distinguishes a zero cap from unlimited", () => {
    // 0 means "none allowed" and must NOT collapse to null.
    expect(parsePlanLimits({ max_flows: 0 }).maxFlows).toBe(0);
  });

  it("rejects negative and non-integer counts", () => {
    expect(parsePlanLimits({ max_flows: -1 }).maxFlows).toBeNull();
    expect(parsePlanLimits({ max_flows: "5" }).maxFlows).toBeNull();
    expect(parsePlanLimits({ max_flows: NaN }).maxFlows).toBeNull();
    expect(parsePlanLimits({ max_flows: 2.7 }).maxFlows).toBe(2);
  });

  it("still reads the pre-existing keys", () => {
    const ent = parsePlanLimits({
      max_users: 10,
      max_contacts: 25000,
      storage_mb: 5120,
      allow_automations: false,
    });
    expect(ent.maxUsers).toBe(10);
    expect(ent.maxContacts).toBe(25000);
    expect(ent.storageMb).toBe(5120);
    expect(ent.allowAutomations).toBe(false);
  });
});

describe("atLimit", () => {
  it("is false when unlimited", () => {
    expect(atLimit(null, 9999)).toBe(false);
  });

  it("blocks once usage reaches the cap", () => {
    expect(atLimit(3, 2)).toBe(false);
    expect(atLimit(3, 3)).toBe(true);
    expect(atLimit(3, 4)).toBe(true);
  });

  it("blocks everything at a zero cap", () => {
    expect(atLimit(0, 0)).toBe(true);
  });
});

describe("sanitizeLimitsInput", () => {
  it("accepts the new count keys", () => {
    expect(
      sanitizeLimitsInput({
        max_automations: 5,
        max_campaigns: 0,
        max_flows: 12,
      }),
    ).toEqual({ max_automations: 5, max_campaigns: 0, max_flows: 12 });
  });

  it("maps null and empty string to unlimited", () => {
    expect(
      sanitizeLimitsInput({ max_automations: null, max_campaigns: "" }),
    ).toEqual({ max_automations: null, max_campaigns: null });
  });

  it("rejects a malformed count rather than coercing it", () => {
    expect(sanitizeLimitsInput({ max_flows: -2 })).toBeNull();
    expect(sanitizeLimitsInput({ max_flows: 1.5 })).toBeNull();
    expect(sanitizeLimitsInput({ max_flows: "many" })).toBeNull();
  });

  it("drops unknown keys instead of persisting them", () => {
    expect(sanitizeLimitsInput({ max_flows: 1, hack: "yes" })).toEqual({
      max_flows: 1,
    });
  });

  it("omits keys that weren't supplied", () => {
    expect(sanitizeLimitsInput({ max_flows: 1 })).toEqual({ max_flows: 1 });
  });

  it("still validates booleans", () => {
    expect(sanitizeLimitsInput({ allow_flows: true })).toEqual({
      allow_flows: true,
    });
    expect(sanitizeLimitsInput({ allow_flows: "true" })).toBeNull();
  });

  it("handles the empty and null payloads", () => {
    expect(sanitizeLimitsInput(null)).toEqual({});
    expect(sanitizeLimitsInput({})).toEqual({});
    expect(sanitizeLimitsInput([])).toBeNull();
  });
});
