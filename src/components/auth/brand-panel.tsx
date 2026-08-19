import type { CSSProperties } from "react";
import { Quote, Send, CheckCheck } from "lucide-react";
import { ChatCircleDots } from "@phosphor-icons/react";

// Marketing panel shown on the right half of the auth pages (login /
// signup / forgot-password) on lg+ screens. Purely decorative — a
// customer quote plus a lightweight, non-interactive mock of the
// Instant inbox. Hidden below lg where the form takes the full width.

// Every green here is mixed from --primary rather than picked off
// Tailwind's emerald scale, so retheming the brand colour carries the
// panel with it. The gradient stops stay just under full primary so the
// bg-primary chips in the inbox mock still read against it.
const PANEL_GREENS = {
  "--auth-deep": "color-mix(in oklab, var(--primary) 52%, #000)",
  "--auth-mid": "color-mix(in oklab, var(--primary) 76%, #000)",
  "--auth-lit": "color-mix(in oklab, var(--primary) 94%, #000)",
  "--auth-tint": "color-mix(in oklab, var(--primary) 52%, #fff)",
  "--auth-tint-soft": "color-mix(in oklab, var(--primary) 26%, #fff)",
} as CSSProperties;

export function AuthBrandPanel() {
  return (
    <aside
      style={PANEL_GREENS}
      className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-linear-to-br from-(--auth-deep) via-(--auth-mid) to-(--auth-lit) p-12 text-white lg:flex"
    >
      {/* Subtle grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 70% 20%, black, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 70% 20%, black, transparent)",
        }}
      />
      {/* Glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-(--auth-tint)/20 blur-3xl"
      />

      {/* Quote */}
      <blockquote className="relative max-w-lg">
        <p className="text-2xl font-semibold leading-snug tracking-tight">
          &ldquo;We run every customer conversation, broadcast, and follow-up
          through Instant now. Our whole team finally works from the same
          inbox.&rdquo;
        </p>
        <footer className="mt-6 flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-(--auth-tint)/20">
            <Quote className="h-5 w-5 text-(--auth-tint)" />
          </div>
          <div>
            <p className="font-semibold">Bettie Porter</p>
            <p className="text-sm text-(--auth-tint-soft)/80">
              Senior Marketing Manager
            </p>
          </div>
        </footer>
      </blockquote>

      {/* Product preview — a lightweight inbox mock peeking up from the bottom */}
      <div className="relative -mb-12 mt-12 overflow-hidden rounded-t-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-sm">
        {/* Window header */}
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
            <ChatCircleDots
              className="h-3.5 w-3.5 text-primary-foreground"
              weight="fill"
            />
          </div>
          <span className="text-sm font-semibold text-white">
            Instant · Inbox
          </span>
        </div>

        {/* Body: conversation list + thread */}
        <div className="grid grid-cols-[minmax(0,7rem)_1fr]">
          {/* Conversation list */}
          <div className="space-y-1 border-r border-white/10 p-2">
            {CONVERSATIONS.map((c, i) => (
              <div
                key={c.name}
                className={`rounded-lg px-2 py-1.5 ${i === 0 ? "bg-white/10" : ""}`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 shrink-0 rounded-full bg-(--auth-tint)/40" />
                  <span className="truncate text-[11px] font-medium text-white/90">
                    {c.name}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-white/50">
                  {c.preview}
                </p>
              </div>
            ))}
          </div>

          {/* Thread */}
          <div className="space-y-2.5 p-3">
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-[11px] text-white/80">
              Hi! Do you ship internationally?
            </div>
            <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-[11px] text-primary-foreground">
              Yes we do — I&apos;ll send you the rates now.
            </div>
            <div className="ml-auto flex items-center gap-1 text-[9px] text-(--auth-tint-soft)/70">
              <CheckCheck className="h-3 w-3" />
              <span>Delivered</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <span className="flex-1 text-[10px] text-white/40">
                Type a message…
              </span>
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                <Send className="h-2.5 w-2.5 text-primary-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

const CONVERSATIONS = [
  { name: "Bettie Porter", preview: "Sounds perfect, thanks!" },
  { name: "Marco Diaz", preview: "Can I get a demo?" },
  { name: "Aisha Khan", preview: "Order #1043 update" },
  { name: "Tom Riley", preview: "Renewal question" },
] as const;
