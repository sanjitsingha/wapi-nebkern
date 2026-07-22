import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGE_CHARS,
  buildWaLink,
  isValidWaNumber,
  normalizeWaNumber,
  qrFileName,
} from "./wa-link";

describe("normalizeWaNumber", () => {
  it("collapses the three ways people write one number", () => {
    expect(normalizeWaNumber("+91 98765 43210")).toBe("919876543210");
    expect(normalizeWaNumber("0091-9876543210")).toBe("919876543210");
    expect(normalizeWaNumber("919876543210")).toBe("919876543210");
  });

  it("drops the 00 international prefix wa.me rejects", () => {
    expect(normalizeWaNumber("0014155551212")).toBe("14155551212");
  });

  it("returns an empty string when there are no digits", () => {
    expect(normalizeWaNumber("")).toBe("");
    expect(normalizeWaNumber("+ () -")).toBe("");
  });
});

describe("isValidWaNumber", () => {
  it("accepts 7-15 digit international numbers", () => {
    expect(isValidWaNumber("919876543210")).toBe(true);
    expect(isValidWaNumber("14155551212")).toBe(true);
    expect(isValidWaNumber("1234567")).toBe(true);
  });

  it("rejects numbers outside E.164 length bounds", () => {
    expect(isValidWaNumber("123456")).toBe(false);
    expect(isValidWaNumber("1234567890123456")).toBe(false);
  });

  it("rejects a leading zero — normalization should have removed it", () => {
    expect(isValidWaNumber("0919876543210")).toBe(false);
  });
});

describe("buildWaLink", () => {
  it("builds a link with the message url-encoded", () => {
    expect(
      buildWaLink({ number: "+91 98765 43210", message: "Hi there!" }),
    ).toBe("https://wa.me/919876543210?text=Hi%20there!");
  });

  it("omits the text param when there is no message", () => {
    const bare = "https://wa.me/919876543210";
    expect(buildWaLink({ number: "919876543210" })).toBe(bare);
    expect(buildWaLink({ number: "919876543210", message: "" })).toBe(bare);
  });

  it("encodes newlines and emoji so the link survives copy-paste", () => {
    const link = buildWaLink({
      number: "919876543210",
      message: "Hi 👋\nI'd like a quote",
    });
    expect(link).toContain("%0A");
    expect(link).not.toContain("\n");
    expect(link).toContain("%F0%9F%91%8B");
  });

  it("truncates a message past the cap instead of failing", () => {
    const link = buildWaLink({
      number: "919876543210",
      message: "a".repeat(MAX_MESSAGE_CHARS + 50),
    });
    expect(link).toBe(
      `https://wa.me/919876543210?text=${"a".repeat(MAX_MESSAGE_CHARS)}`,
    );
  });

  // Half-typed numbers are the normal state of the input, not an error.
  it("returns null while the number is still incomplete", () => {
    expect(buildWaLink({ number: "", message: "Hi" })).toBeNull();
    expect(buildWaLink({ number: "+91 987", message: "Hi" })).toBeNull();
  });
});

describe("qrFileName", () => {
  it("names the file after the normalized number", () => {
    expect(qrFileName("+91 98765 43210", "png")).toBe(
      "whatsapp-qr-919876543210.png",
    );
    expect(qrFileName("919876543210", "svg")).toBe(
      "whatsapp-qr-919876543210.svg",
    );
  });

  it("falls back to a generic name when no digits were typed", () => {
    expect(qrFileName("", "png")).toBe("whatsapp-qr-code.png");
  });
});
