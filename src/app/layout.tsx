import type { Metadata, Viewport } from 'next';
import { Manrope, JetBrains_Mono, Noto_Color_Emoji } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/hooks/use-theme';
import { ThemedToaster } from '@/components/themed-toaster';

/**
 * The single typeface for the whole product — app, marketing and
 * docs alike (see `components/lp2/font.ts`, which loads the same
 * family for the lp2 surfaces).
 *
 * A variable font, so the full 200-800 range ships in one file and
 * every `font-*` weight class resolves without extra downloads. It
 * has no italic: `italic` renders as a browser-synthesised slant,
 * which is fine for the handful of places that use it (placeholders
 * and empty states).
 */
const sans = Manrope({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

/**
 * The monospace half of the type system, which until now did not
 * exist: `--font-mono` in globals.css pointed at `--font-geist-mono`,
 * a variable nothing ever defined. An undefined custom property makes
 * the whole `font-family` declaration invalid, so every `font-mono` in
 * the app — ids, API keys, code samples, the admin panel's numbers —
 * quietly rendered in the body sans.
 */
const mono = JetBrains_Mono({
  variable: '--font-mono-family',
  subsets: ['latin'],
  display: 'swap',
});

/**
 * One emoji style on every computer — Google's Noto Color Emoji —
 * instead of whatever the device's font draws (Segoe on Windows, Noto
 * on Linux, Apple's on a Mac). Customers never see this: we send emoji
 * as text and their phone draws WhatsApp's own. WhatsApp's artwork
 * itself isn't licensed for other apps.
 *
 * Not preloaded: Google splits it into ~11 chunks by character range
 * (2 MB in all) and a browser fetches only the chunks for emoji on the
 * page. The build gets the COLRv1 cut, which Safari can't draw, so
 * globals.css only puts it in the stack where `font-tech(color-COLRv1)`
 * holds — Safari keeps Apple's emoji. No metric-adjusted fallback face:
 * that exists to stop text reflowing, and emoji are their own glyphs.
 */
const emoji = Noto_Color_Emoji({
  variable: '--font-emoji',
  weight: '400',
  subsets: ['emoji'],
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dripo.nebkern.com'
).replace(/\/$/, '');

export const metadata: Metadata = {
  // Resolves relative URLs in OG/Twitter tags to absolute ones. Without
  // it Next warns and social scrapers get paths they cannot fetch.
  metadataBase: new URL(SITE_URL),
  title: {
    // What a browser tab and a Google result say. `default` is the
    // homepage; `template` wraps every page that sets its own title.
    default: 'Dripo WhatsApp for Business — WhatsApp CRM & Automation',
    template: '%s — Dripo WhatsApp for Business',
  },
  description:
    'Dripo by Nebkern Technology — WhatsApp marketing automation with a shared team inbox, AI agents, campaigns and pipelines, on the official WhatsApp Business API.',
  /**
   * `siteName` is what Google prints ABOVE the blue title line. With
   * nothing declared it falls back to the bare domain, which is why
   * results read "nebkern.com" rather than the product's name.
   *
   * Declared at the root so every public page carries it. Metadata is
   * shallow-merged and nested objects are REPLACED, not deep-merged —
   * so any page that defines its own `openGraph` must re-declare
   * `siteName` or it will silently lose it.
   */
  //
  // No `url` here. A root `openGraph.url` is inherited by every page that
  // does not declare its own `openGraph`, so /features/shared-inbox,
  // /ask-maya and the rest all announced og:url = the homepage — telling
  // crawlers each of them IS the homepage, against its own canonical.
  // Without it, scrapers use the address they fetched, and the canonical
  // (`alternates.canonical` per page) stays the one authoritative URL.
  openGraph: {
    siteName: 'Dripo WhatsApp for Business',
    type: 'website',
    locale: 'en_IN',
  },
  // Large preview cards when a link is shared. The image itself comes
  // from app/opengraph-image.tsx, which X/Twitter falls back to.
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: false,
    follow: false,
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0b6623',
  colorScheme: 'light',
};

// Analytics deliberately does NOT live here. The root layout wraps the
// signed-in app as well as the public site, and only the public site is
// measured — see src/components/analytics.tsx for why, and the
// (marketing) and docs layouts for where it is actually rendered.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${emoji.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full font-sans">
        <ThemeProvider>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
