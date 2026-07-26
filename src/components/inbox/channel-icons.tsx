// ============================================================
// Channel brand marks.
//
// Full-colour logos for each messaging channel, used wherever the inbox
// names a platform (the conversation-list channel tabs today; the thread
// header / composer later). Deliberately the *brand* logos — green
// WhatsApp bubble, the Messenger gradient, the Instagram gradient — not
// the monochrome lucide glyphs, so a channel reads at a glance.
//
// Each is a plain presentational SVG sized in `em`/via className, so a
// caller controls the size with `size-4` etc. The gradient ids are
// static: every logo renders at most once in the tab bar today, so
// there's no duplicate-id clash. If one ever needs to appear many times
// on a page at once, swap the static id for React's `useId()`.
// ============================================================

type IconProps = { className?: string };

/** WhatsApp — the green speech bubble with the white handset. */
export function WhatsAppLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <path
        fill="#25D366"
        d="M16.003 0h-.006C7.17 0 0 7.172 0 16c0 3.503 1.128 6.75 3.045 9.386L1.05 31.328l6.15-1.966A15.9 15.9 0 0 0 16.003 32C24.83 32 32 24.827 32 16S24.83 0 16.003 0z"
      />
      <path
        fill="#fff"
        d="M25.314 22.594c-.386 1.09-1.918 1.994-3.14 2.258-.836.178-1.928.32-5.604-1.204-4.702-1.948-7.73-6.726-7.966-7.036-.226-.31-1.9-2.53-1.9-4.826s1.166-3.424 1.636-3.904c.386-.394.87-.574 1.372-.574.162 0 .308.008.44.014.394.018.592.042.852.664.324.78 1.114 2.774 1.208 2.972.096.198.192.466.058.756-.126.298-.236.418-.434.646-.198.228-.386.404-.584.65-.18.214-.384.446-.156.842.228.388 1.014 1.67 2.176 2.704 1.5 1.336 2.746 1.75 3.192 1.936.332.138.728.106.97-.152.308-.332.688-.882 1.074-1.424.274-.388.62-.436.984-.298.372.13 2.354 1.11 2.756 1.312.402.202.67.298.768.466.096.17.096.968-.29 2.058z"
      />
    </svg>
  );
}

/** Messenger — the 2020 gradient bubble with the white lightning glyph. */
export function MessengerLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden focusable="false">
      <defs>
        <radialGradient
          id="wacrm-messenger-grad"
          cx="0.19"
          cy="1"
          r="1.1"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stopColor="#0099ff" />
          <stop offset="0.6" stopColor="#a033ff" />
          <stop offset="0.9" stopColor="#ff5280" />
          <stop offset="1" stopColor="#ff7061" />
        </radialGradient>
      </defs>
      <path
        fill="url(#wacrm-messenger-grad)"
        d="M18 0C7.99 0 0 7.34 0 17.25c0 5.19 2.19 9.66 5.75 12.75.3.26.48.63.49 1.03l.1 3.25a1.44 1.44 0 0 0 2.02 1.28l3.63-1.6c.31-.14.66-.16.98-.08 1.64.45 3.39.69 5.03.69C28.01 34.5 36 27.16 36 17.25S28.01 0 18 0z"
      />
      <path
        fill="#fff"
        d="M7.2 22.56l5.29-8.39a2.7 2.7 0 0 1 3.9-.72l4.21 3.15c.38.29.91.29 1.29 0l5.68-4.31c.76-.58 1.75.33 1.24 1.15l-5.29 8.39a2.7 2.7 0 0 1-3.9.72l-4.21-3.15a1.08 1.08 0 0 0-1.29 0l-5.68 4.31c-.76.58-1.75-.33-1.24-1.15z"
      />
    </svg>
  );
}

/** Instagram — the gradient rounded-square camera. */
export function InstagramLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient
          id="wacrm-instagram-grad"
          x1="0"
          y1="1"
          x2="1"
          y2="0"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stopColor="#feda75" />
          <stop offset="0.25" stopColor="#fa7e1e" />
          <stop offset="0.5" stopColor="#d62976" />
          <stop offset="0.75" stopColor="#962fbf" />
          <stop offset="1" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#wacrm-instagram-grad)" />
      <rect
        x="7"
        y="7"
        width="18"
        height="18"
        rx="5.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
      />
      <circle
        cx="16"
        cy="16"
        r="4.6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
      />
      <circle cx="21.6" cy="10.4" r="1.5" fill="#fff" />
    </svg>
  );
}
