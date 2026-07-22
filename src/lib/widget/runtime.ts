/**
 * Generates the JavaScript served from /widget.js — the code that
 * actually runs on the customer's website.
 *
 * Constraints that shaped this, all stemming from "it runs on a page we
 * don't control":
 *   - Everything lives in a shadow root. The host page's CSS cannot
 *     reach in, and our styles cannot leak out. Without this, any site
 *     with an aggressive `button { }` rule would wreck the widget.
 *   - No dependencies, no build step, ES5-ish syntax. It is served as
 *     plain text to whatever browser the visitor brought.
 *   - Every piece of operator-supplied text goes in via `textContent`.
 *     The only innerHTML is a hardcoded SVG constant below.
 *   - The wa.me link is built on the SERVER (see buildWaLink) and
 *     embedded as a finished string, so link construction is covered by
 *     the same tests as the QR generator rather than reimplemented here
 *     in untested inline JS.
 */

import { buildWaLink } from '@/lib/qr/wa-link';
import type { WidgetConfig } from './config';

/**
 * Serialize a value for embedding inside a <script> body.
 *
 * The route serves this as application/javascript, where `</script>`
 * carries no meaning — but escaping is free, and it means the same
 * string stays safe if it is ever inlined into HTML instead. U+2028 and
 * U+2029 are escaped because they are valid JSON but are line
 * terminators in older JS parsers.
 */
export function jsonForScript(value: unknown): string {
  // U+2028 and U+2029 are LINE TERMINATORS to a JavaScript parser, so
  // they cannot appear literally inside a regex here — the file would
  // not parse at all. Build them from char codes and swap with
  // split/join, which also keeps them visible to a reader.
  const LINE_SEP = String.fromCharCode(0x2028);
  const PARA_SEP = String.fromCharCode(0x2029);
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .split(LINE_SEP)
    .join('\\u2028')
    .split(PARA_SEP)
    .join('\\u2029');
}

/** Served when the key is unknown or the widget is switched off. */
export function buildDisabledScript(reason: string): string {
  // Deliberately a valid, silent no-op rather than a 404: a snippet left
  // on a live site should degrade to nothing, not to a console error the
  // site owner has to explain to their developer.
  return `/* wa-widget: ${reason.replace(/\*\//g, '')} */\n`;
}

export interface WidgetScriptInput {
  config: WidgetConfig;
  /** Where the visitor lands. Precomputed so it stays server-tested. */
  href: string;
}

/** Whether this config can produce a working widget at all. */
export function widgetHref(config: WidgetConfig): string | null {
  return buildWaLink({
    number: config.phone,
    message: config.prefilledMessage,
  });
}

export function buildWidgetScript({ config, href }: WidgetScriptInput): string {
  // Only the fields the browser actually needs. The phone number is
  // already baked into `href`, so it is not shipped separately.
  const payload = {
    href,
    name: config.businessName || 'WhatsApp',
    tagline: config.tagline,
    greeting: config.greeting,
    color: config.brandColor,
    placement: config.placement,
    autoOpen: config.autoOpenDelaySeconds,
    mobile: config.showOnMobile,
    desktop: config.showOnDesktop,
  };

  return `(function () {
  "use strict";

  var C = ${jsonForScript(payload)};

  // Two copies of the snippet on one page (a common CMS mistake) must
  // not produce two bubbles.
  if (window.__waChatWidgetLoaded) return;
  window.__waChatWidgetLoaded = true;

  var SIDE = C.placement === "left" ? "left" : "right";

  // Evaluated once at load. A visitor who rotates their tablet mid-visit
  // keeps whatever they got — re-lay-out on resize is not worth the
  // complexity for a chat bubble.
  var isSmall = window.matchMedia("(max-width: 640px)").matches;
  if (isSmall && !C.mobile) return;
  if (!isSmall && !C.desktop) return;

  var WA_ICON =
    '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">' +
    '<path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z"/>' +
    '<path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24z"/>' +
    "</svg>";

  var CLOSE_ICON =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M6 6l12 12M18 6L6 18"/></svg>';

  var host = document.createElement("div");
  // \`all: initial\` blocks inherited properties (font, colour, direction)
  // from the host page; the rest is set inline because the host element
  // itself sits outside the shadow root and is therefore reachable by
  // the page's own selectors.
  host.style.cssText =
    "all: initial; position: fixed; z-index: 2147483000; bottom: 0; " +
    SIDE + ": 0;";
  host.setAttribute("data-wa-chat-widget", "");

  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host, * { box-sizing: border-box; }",
    ".wrap { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0 20px 20px 20px; display: flex; flex-direction: column; align-items: " +
      (SIDE === "left" ? "flex-start" : "flex-end") +
      "; }",
    ".bubble { width: 60px; height: 60px; border-radius: 50%; border: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #fff; background: " +
      C.color +
      "; box-shadow: 0 6px 20px rgba(0,0,0,.28); transition: transform .18s ease; padding: 0; }",
    ".bubble:hover { transform: scale(1.06); }",
    ".bubble:focus-visible { outline: 3px solid rgba(0,0,0,.35); outline-offset: 3px; }",
    ".panel { width: 320px; max-width: calc(100vw - 40px); background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,.28); margin-bottom: 14px; opacity: 0; transform: translateY(10px) scale(.97); pointer-events: none; transition: opacity .18s ease, transform .18s ease; }",
    ".panel.open { opacity: 1; transform: none; pointer-events: auto; }",
    ".head { background: " +
      C.color +
      "; color: #fff; padding: 16px 18px; display: flex; align-items: center; gap: 12px; }",
    ".avatar { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,.22); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 17px; flex: 0 0 auto; text-transform: uppercase; }",
    ".who { min-width: 0; flex: 1 1 auto; }",
    ".name { font-weight: 600; font-size: 15px; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".tagline { font-size: 12px; opacity: .85; line-height: 1.3; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".x { background: transparent; border: 0; color: #fff; cursor: pointer; opacity: .85; padding: 4px; display: flex; border-radius: 6px; }",
    ".x:hover { opacity: 1; background: rgba(255,255,255,.16); }",
    ".body { padding: 20px 18px; background: #ECE5DD; }",
    ".msg { position: relative; background: #fff; border-radius: 0 10px 10px 10px; padding: 11px 13px; font-size: 14px; line-height: 1.45; color: #111; box-shadow: 0 1px 1px rgba(0,0,0,.12); white-space: pre-wrap; word-wrap: break-word; }",
    ".foot { padding: 14px 18px 18px; background: #ECE5DD; }",
    ".cta { display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; padding: 12px 16px; border-radius: 999px; border: 0; cursor: pointer; font-size: 15px; font-weight: 600; color: #fff; background: " +
      C.color +
      "; text-decoration: none; }",
    ".cta:hover { filter: brightness(1.06); }",
    "@media (prefers-reduced-motion: reduce) { .panel, .bubble { transition: none; } }",
  ].join("\\n");

  var wrap = document.createElement("div");
  wrap.className = "wrap";

  // ---- panel ----
  var panel = document.createElement("div");
  panel.className = "panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chat on WhatsApp");

  var head = document.createElement("div");
  head.className = "head";

  var avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = (C.name || "W").trim().charAt(0);

  var who = document.createElement("div");
  who.className = "who";
  var nameEl = document.createElement("div");
  nameEl.className = "name";
  nameEl.textContent = C.name;
  who.appendChild(nameEl);
  if (C.tagline) {
    var tagEl = document.createElement("div");
    tagEl.className = "tagline";
    tagEl.textContent = C.tagline;
    who.appendChild(tagEl);
  }

  var closeBtn = document.createElement("button");
  closeBtn.className = "x";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close chat");
  closeBtn.innerHTML = CLOSE_ICON;

  head.appendChild(avatar);
  head.appendChild(who);
  head.appendChild(closeBtn);

  var body = document.createElement("div");
  body.className = "body";
  var msg = document.createElement("div");
  msg.className = "msg";
  msg.textContent = C.greeting;
  body.appendChild(msg);

  var foot = document.createElement("div");
  foot.className = "foot";
  var cta = document.createElement("a");
  cta.className = "cta";
  cta.href = C.href;
  cta.target = "_blank";
  // noopener is what stops the opened WhatsApp tab from getting a
  // window.opener handle back into the customer's page.
  cta.rel = "noopener noreferrer";
  cta.innerHTML = WA_ICON.replace('width="30" height="30"', 'width="20" height="20"');
  var ctaText = document.createElement("span");
  ctaText.textContent = "Start chat";
  cta.appendChild(ctaText);
  foot.appendChild(cta);

  panel.appendChild(head);
  panel.appendChild(body);
  panel.appendChild(foot);

  // ---- bubble ----
  var bubble = document.createElement("button");
  bubble.className = "bubble";
  bubble.type = "button";
  bubble.setAttribute("aria-label", "Chat on WhatsApp");
  bubble.setAttribute("aria-expanded", "false");
  bubble.innerHTML = WA_ICON;

  var open = false;
  // Declared before the handlers that assign it. \`var\` would hoist
  // anyway, but reading it below its use is needless head-scratching.
  var autoOpenCancelled = false;
  function setOpen(next) {
    open = next;
    panel.classList.toggle("open", open);
    bubble.setAttribute("aria-expanded", open ? "true" : "false");
    bubble.innerHTML = open ? CLOSE_ICON : WA_ICON;
  }

  bubble.addEventListener("click", function () {
    setOpen(!open);
    // Any manual interaction cancels a pending auto-open, so the panel
    // can't spring back after someone has dismissed it.
    autoOpenCancelled = true;
  });
  closeBtn.addEventListener("click", function () {
    setOpen(false);
    autoOpenCancelled = true;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) setOpen(false);
  });

  wrap.appendChild(panel);
  wrap.appendChild(bubble);
  root.appendChild(style);
  root.appendChild(wrap);
  document.body.appendChild(host);

  // ---- auto-open ----
  // Once per tab, not once per page view: opening itself on every page
  // of a browsing session is the single most irritating thing a chat
  // widget does.
  if (typeof C.autoOpen === "number") {
    var SEEN = "__waChatWidgetAutoOpened";
    var alreadySeen = false;
    try {
      alreadySeen = window.sessionStorage.getItem(SEEN) === "1";
    } catch (err) {
      // Storage can throw in private mode / partitioned contexts. Treat
      // it as "not seen" and simply auto-open at most once per page.
      alreadySeen = false;
    }
    if (!alreadySeen) {
      window.setTimeout(function () {
        if (autoOpenCancelled || open) return;
        setOpen(true);
        try {
          window.sessionStorage.setItem(SEEN, "1");
        } catch (err) {
          /* no-op */
        }
      }, C.autoOpen * 1000);
    }
  }
})();
`;
}
