import { describe, expect, it } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  checkPassword,
  firstPasswordError,
  isPasswordValid,
} from "./password";

// A password that satisfies every rule — the baseline the negative
// cases below each break in exactly one way.
const VALID = "Str0ng!pass";

describe("isPasswordValid", () => {
  it("accepts a password meeting every rule", () => {
    expect(isPasswordValid(VALID)).toBe(true);
  });

  it.each([
    ["too short", "Ab1!c"],
    ["no lowercase", "STR0NG!PASS"],
    ["no uppercase", "str0ng!pass"],
    ["no number", "Strong!pass"],
    ["no special character", "Str0ngpass1"],
    ["empty", ""],
  ])("rejects a password with %s", (_label, value) => {
    expect(isPasswordValid(value)).toBe(false);
  });

  it("rejects a symbol outside GoTrue's accepted set", () => {
    // `£` is not in !@#$%^&*()_+-=[]{};'\:"|<>?,./`~ — GoTrue would not
    // count it as a symbol, so neither do we. Failing here (with the
    // rule on screen) beats a generic server rejection after submit.
    expect(isPasswordValid("Str0ng£pass")).toBe(false);
  });

  it.each([["!"], ["@"], ["#"], ["$"], ["|"], ["~"], ["`"], ["\\"], ["/"], ["-"], ["]"]])(
    "accepts %s as the special character",
    (symbol) => {
      expect(isPasswordValid(`Str0ngpa${symbol}s`)).toBe(true);
    },
  );

  it(`treats exactly ${PASSWORD_MIN_LENGTH} characters as long enough`, () => {
    const exact = "Ab1!efgh";
    expect(exact).toHaveLength(PASSWORD_MIN_LENGTH);
    expect(isPasswordValid(exact)).toBe(true);
    expect(isPasswordValid(exact.slice(0, -1))).toBe(false);
  });
});

describe("checkPassword", () => {
  it("reports one state per rule, in declaration order", () => {
    const states = checkPassword("");
    expect(states.map((s) => s.rule.id)).toEqual(
      PASSWORD_RULES.map((r) => r.id),
    );
  });

  it("marks only the satisfied rules as met", () => {
    // Lowercase only: fails length, uppercase, number and special.
    const met = checkPassword("abc")
      .filter((s) => s.met)
      .map((s) => s.rule.id);
    expect(met).toEqual(["lowercase"]);
  });

  it("marks every rule met for a valid password", () => {
    expect(checkPassword(VALID).every((s) => s.met)).toBe(true);
  });
});

describe("firstPasswordError", () => {
  it("returns null when the password passes", () => {
    expect(firstPasswordError(VALID)).toBeNull();
  });

  it("reports length before the character-class rules", () => {
    // "aB1!" breaks length *and* nothing else; length is listed first
    // so the user fixes the most basic problem before being told about
    // character classes one at a time.
    expect(firstPasswordError("aB1!")).toMatch(/at least/i);
  });

  it("reports the earliest unmet rule once length is satisfied", () => {
    expect(firstPasswordError("abcdefgh")).toMatch(/uppercase/i);
  });
});
