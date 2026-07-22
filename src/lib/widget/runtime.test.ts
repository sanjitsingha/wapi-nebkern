import { describe, expect, it } from "vitest";
import { sanitizeWidgetConfig } from "./config";
import {
  buildDisabledScript,
  buildWidgetScript,
  jsonForScript,
  widgetHref,
} from "./runtime";

const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

function config(overrides = {}) {
  return sanitizeWidgetConfig({
    phone: "919876543210",
    prefilledMessage: "Hi!",
    businessName: "Acme Ltd",
    greeting: "How can we help?",
    brandColor: "#25D366",
    ...overrides,
  });
}

describe("jsonForScript", () => {
  it("escapes < so the payload can't open a tag", () => {
    const out = jsonForScript({ a: "</script><img onerror=alert(1)>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c");
  });

  // The escaping here is written with literal U+2028/U+2029 in a regex,
  // which are invisible on screen. These two tests are the guard: if
  // either literal is ever mangled into a plain space, they fail.
  it("escapes the U+2028/2029 line separators", () => {
    const out = jsonForScript({ a: `x${LINE_SEP}y${PARA_SEP}z` });
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
    expect(out).not.toContain(LINE_SEP);
    expect(out).not.toContain(PARA_SEP);
  });

  it("leaves ordinary spaces completely alone", () => {
    const out = jsonForScript({ a: "hello there friend" });
    expect(out).toContain("hello there friend");
    expect(out).not.toContain("\\u2028");
  });

  it("round-trips through JSON.parse after unescaping", () => {
    const value = { greeting: "Hi <b>there</b>", n: 3 };
    expect(JSON.parse(jsonForScript(value).replace(/\\u003c/g, "<"))).toEqual(
      value,
    );
  });
});

describe("widgetHref", () => {
  it("builds the same wa.me link the QR generator would", () => {
    expect(widgetHref(config())).toBe("https://wa.me/919876543210?text=Hi!");
  });

  it("is null when no number has been snapshotted yet", () => {
    expect(widgetHref(config({ phone: "" }))).toBeNull();
  });
});

describe("buildWidgetScript", () => {
  const script = buildWidgetScript({
    config: config(),
    href: "https://wa.me/919876543210?text=Hi!",
  });

  it("embeds the precomputed link", () => {
    expect(script).toContain("https://wa.me/919876543210?text=Hi!");
  });

  it("guards against a double-embedded snippet", () => {
    expect(script).toContain("__waChatWidgetLoaded");
  });

  it("isolates itself in a shadow root", () => {
    expect(script).toContain("attachShadow");
  });

  it("opens the chat with noopener", () => {
    expect(script).toContain("noopener");
  });

  it("interpolates only a validated colour into the CSS", () => {
    const evil = buildWidgetScript({
      config: config({ brandColor: "#fff;}body{display:none}" }),
      href: "https://wa.me/1",
    });
    // sanitizeWidgetConfig already replaced it with the default.
    expect(evil).not.toContain("display:none");
    expect(evil).toContain("#25D366");
  });

  it("passes operator text through JSON, not string concatenation", () => {
    const out = buildWidgetScript({
      config: config({ greeting: 'quote " and </script> inside' }),
      href: "https://wa.me/1",
    });
    expect(out).not.toContain("</script>");
  });

  it("omits the phone number itself — it is already inside href", () => {
    const out = buildWidgetScript({
      config: config({ phone: "919876543210" }),
      href: "https://wa.me/OTHER",
    });
    expect(out).not.toContain('"919876543210"');
  });
});

describe("buildDisabledScript", () => {
  it("is an inert comment, not an error", () => {
    const out = buildDisabledScript("widget disabled");
    expect(out.trim().startsWith("/*")).toBe(true);
    expect(out).toContain("widget disabled");
  });

  it("cannot be broken out of by the reason string", () => {
    expect(buildDisabledScript("evil */ alert(1) /*")).not.toContain(
      "*/ alert(1)",
    );
  });
});
