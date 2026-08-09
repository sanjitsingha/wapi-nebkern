import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/hooks/use-theme';
import { ThemedToaster } from '@/components/themed-toaster';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://instant.nebkern.com'
).replace(/\/$/, '');

export const metadata: Metadata = {
  // Resolves relative URLs in OG/Twitter tags to absolute ones. Without
  // it Next warns and social scrapers get paths they cannot fetch.
  metadataBase: new URL(SITE_URL),
  title: {
    // What a browser tab and a Google result say. `default` is the
    // homepage; `template` wraps every page that sets its own title.
    default: 'Instant — WhatsApp Marketing Automation',
    template: '%s — Instant',
  },
  description:
    'Instant by Nebkern Technology — WhatsApp marketing automation with a shared team inbox, AI agents, campaigns and pipelines, on the official WhatsApp Business API.',
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
  openGraph: {
    siteName: 'Instant',
    type: 'website',
    locale: 'en_IN',
    url: SITE_URL,
  },
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [{ url: '/icon' }],
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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="bg-background text-foreground min-h-full font-sans">
        <ThemeProvider>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
