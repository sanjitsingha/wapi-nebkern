import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAND_COLOR,
  DEFAULT_WIDGET_CONFIG,
  WIDGET_LIMITS,
  buildEmbedSnippet,
  generatePublicKey,
  isHexColor,
  sanitizeWidgetConfig,
  widgetConfigFromRow,
  widgetConfigToRow,
} from "./config";

// Built rather than pasted. A literal control byte in a source file is
// invisible in review, and editors/tooling mangle it silently — which
// produces a test that asserts nothing while still passing.
const BEL = String.fromCharCode(7);
const DEL = String.fromCharCode(127);
const C1 = String.fromCharCode(0x85);
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);
const TAB = String.fromCharCode(9);
const NEWLINE = String.fromCharCode(10);

describe("isHexColor", () => {
  it("accepts 3- and 6-digit hex", () => {
    expect(isHexColor("#25D366")).toBe(true);
    expect(isHexColor("#fff")).toBe(true);
    expect(isHexColor("#AbC123")).toBe(true);
  });

  it("rejects anything that isn't a hex literal", () => {
    expect(isHexColor("25D366")).toBe(false);
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor("#12345")).toBe(false);
    expect(isHexColor("#12g456")).toBe(false);
  });

  // The colour is interpolated into a stylesheet served onto someone
  // else's page — a CSS breakout here would be the worst bug in the
  // feature, so it gets its own test.
  it("rejects CSS injection attempts", () => {
    expect(isHexColor("#fff;}body{display:none}")).toBe(false);
    expect(isHexColor("red;background:url(//evil)")).toBe(false);
    expect(isHexColor("#fff</style><script>")).toBe(false);
  });
});

describe("sanitizeWidgetConfig", () => {
  it("returns defaults for junk input", () => {
    expect(sanitizeWidgetConfig(null)).toEqual(DEFAULT_WIDGET_CONFIG);
    expect(sanitizeWidgetConfig(undefined)).toEqual(DEFAULT_WIDGET_CONFIG);
    expect(sanitizeWidgetConfig("nope")).toEqual(DEFAULT_WIDGET_CONFIG);
    expect(sanitizeWidgetConfig(42)).toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("falls back to the default colour rather than failing the save", () => {
    const out = sanitizeWidgetConfig({
      brandColor: "#fff;}body{display:none}",
      greeting: "Keep me",
    });
    expect(out.brandColor).toBe(DEFAULT_BRAND_COLOR);
    // The rest of the save survives — that's the point of per-field fallback.
    expect(out.greeting).toBe("Keep me");
  });

  it("keeps a valid colour", () => {
    expect(sanitizeWidgetConfig({ brandColor: "#123abc" }).brandColor).toBe(
      "#123abc",
    );
  });

  it("strips the phone down to digits", () => {
    expect(sanitizeWidgetConfig({ phone: "+91 98765-43210" }).phone).toBe(
      "919876543210",
    );
  });

  it("clamps free text to its limit", () => {
    const out = sanitizeWidgetConfig({
      businessName: "a".repeat(500),
      greeting: "b".repeat(500),
      tagline: "c".repeat(500),
    });
    expect(out.businessName).toHaveLength(WIDGET_LIMITS.businessName);
    expect(out.greeting).toHaveLength(WIDGET_LIMITS.greeting);
    expect(out.tagline).toHaveLength(WIDGET_LIMITS.tagline);
  });

  it("strips C0 control characters", () => {
    expect(sanitizeWidgetConfig({ tagline: `a${BEL}b` }).tagline).toBe("ab");
  });

  it("strips DEL and the C1 block", () => {
    expect(sanitizeWidgetConfig({ tagline: `a${DEL}b${C1}c` }).tagline).toBe(
      "abc",
    );
  });

  it("strips the U+2028/2029 line separators", () => {
    expect(
      sanitizeWidgetConfig({ tagline: `a${LINE_SEP}b${PARA_SEP}c` }).tagline,
    ).toBe("abc");
  });

  // A multi-line greeting is a legitimate thing to write, so these two
  // must survive even though they are technically control characters.
  it("keeps tabs and newlines", () => {
    const greeting = `Hi there!${NEWLINE}Second line${TAB}indented`;
    expect(sanitizeWidgetConfig({ greeting }).greeting).toBe(greeting);
  });

  it("keeps ordinary unicode, including emoji", () => {
    const greeting = "Hej! 👋 Grüße";
    expect(sanitizeWidgetConfig({ greeting }).greeting).toBe(greeting);
  });

  it("only accepts the two placements", () => {
    expect(sanitizeWidgetConfig({ placement: "left" }).placement).toBe("left");
    expect(sanitizeWidgetConfig({ placement: "top" }).placement).toBe("right");
  });

  it("clamps the auto-open delay and rejects nonsense", () => {
    expect(
      sanitizeWidgetConfig({ autoOpenDelaySeconds: 5 }).autoOpenDelaySeconds,
    ).toBe(5);
    expect(
      sanitizeWidgetConfig({ autoOpenDelaySeconds: 99999 })
        .autoOpenDelaySeconds,
    ).toBe(WIDGET_LIMITS.autoOpenDelaySeconds);
    // Negative, NaN and non-numbers all mean "never auto-open".
    expect(
      sanitizeWidgetConfig({ autoOpenDelaySeconds: -3 }).autoOpenDelaySeconds,
    ).toBeNull();
    expect(
      sanitizeWidgetConfig({ autoOpenDelaySeconds: NaN }).autoOpenDelaySeconds,
    ).toBeNull();
    expect(
      sanitizeWidgetConfig({ autoOpenDelaySeconds: "5" }).autoOpenDelaySeconds,
    ).toBeNull();
  });

  it("keeps booleans and ignores non-booleans", () => {
    expect(sanitizeWidgetConfig({ enabled: false }).enabled).toBe(false);
    expect(sanitizeWidgetConfig({ enabled: "false" }).enabled).toBe(true);
    expect(sanitizeWidgetConfig({ showOnMobile: false }).showOnMobile).toBe(
      false,
    );
  });
});

describe("row round-trip", () => {
  it("survives config -> row -> config unchanged", () => {
    const config = sanitizeWidgetConfig({
      enabled: false,
      phone: "919876543210",
      prefilledMessage: "Hi!",
      businessName: "Acme",
      tagline: "Fast replies",
      greeting: "How can we help?",
      brandColor: "#123abc",
      placement: "left",
      autoOpenDelaySeconds: 8,
      showOnMobile: false,
      showOnDesktop: true,
    });
    expect(widgetConfigFromRow(widgetConfigToRow(config))).toEqual(config);
  });

  it("maps an empty phone to NULL for the DB, not an empty string", () => {
    expect(widgetConfigToRow(DEFAULT_WIDGET_CONFIG).phone).toBeNull();
  });

  it("reads a NULL phone/delay back as empty/null", () => {
    const config = widgetConfigFromRow({
      enabled: true,
      phone: null,
      prefilled_message: "",
      business_name: "",
      tagline: "t",
      greeting: "g",
      brand_color: "#25D366",
      placement: "right",
      auto_open_delay_seconds: null,
      show_on_mobile: true,
      show_on_desktop: true,
    });
    expect(config.phone).toBe("");
    expect(config.autoOpenDelaySeconds).toBeNull();
  });
});

describe("generatePublicKey", () => {
  it("is url-safe and long enough to not be guessable", () => {
    expect(generatePublicKey()).toMatch(/^[0-9a-f]{36}$/);
  });

  it("does not repeat", () => {
    const keys = new Set(Array.from({ length: 200 }, generatePublicKey));
    expect(keys.size).toBe(200);
  });
});

describe("buildEmbedSnippet", () => {
  it("builds an async script tag", () => {
    expect(buildEmbedSnippet("https://app.example.com", "abc123")).toBe(
      '<script src="https://app.example.com/widget.js?id=abc123" async></script>',
    );
  });

  it("does not double up the slash on a trailing-slash origin", () => {
    expect(buildEmbedSnippet("https://app.example.com/", "abc")).toContain(
      "https://app.example.com/widget.js",
    );
  });
});
