"use client";

import { cn } from "@/lib/utils";
import { avatarColor } from "@/lib/avatar-color";

/**
 * The one round avatar for a person — a contact or a teammate.
 *
 * Their photo if they have one, else a coloured initial on the stable
 * tonal pair from `avatarColor`. Both branches are the same circle, so
 * a contact and the agent assigned to them read as the same kind of
 * thing wherever they appear together.
 *
 * `seed` is what fixes the colour: pass the contact's `id` (or the
 * teammate's name, which is what the inbox assign control seeds with)
 * so the same person keeps one colour across every view. It defaults
 * to `name`, which is stable enough on its own but collides between
 * two people who share a first name.
 *
 * Plain `<img>`, not `next/image`: avatar URLs come from WhatsApp's
 * CDN and member uploads, and `images.remotePatterns` in next.config.ts
 * only allows our own media host — `next/image` would throw on the rest.
 */
export function PersonAvatar({
  name,
  avatarUrl,
  seed,
  className,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  seed?: string | null;
  className?: string;
}) {
  const label = (name ?? "").trim();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={label || "Avatar"}
        className={cn("size-5 shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  const c = avatarColor(seed || label);
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
        className,
      )}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {(label || "?").charAt(0).toUpperCase()}
    </span>
  );
}
