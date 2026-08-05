import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/hooks/use-theme";
import { ThemedToaster } from "@/components/themed-toaster";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "wacrm",
    template: "%s — wacrm",
  },
  description: "Self-hostable CRM template for WhatsApp.",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [{ url: "/icon" }],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b6623",
  colorScheme: "light",
};

/**
 * Umami analytics — cookieless page-view counting.
 *
 * Configured, not hardcoded. This repository is MIT and self-hostable
 * (see package.json), so baking in one deployment's website id would
 * send every fork's traffic to that account — polluting their numbers
 * and quietly reporting other people's visitors to a third party.
 * Unset = no script, no requests, no subprocessor.
 *
 * `UMAMI_SRC` is overridable so a self-hoster can point at their own
 * Umami instance rather than the cloud service.
 */
const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const UMAMI_SRC =
  process.env.NEXT_PUBLIC_UMAMI_SRC || "https://cloud.umami.is/script.js";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground font-sans">
        <ThemeProvider>
          {children}
          <ThemedToaster />
        </ThemeProvider>
        {UMAMI_WEBSITE_ID && (
          // afterInteractive, not beforeInteractive: analytics must never
          // sit on the critical path of a page someone is waiting for.
          <Script
            defer
            strategy="afterInteractive"
            src={UMAMI_SRC}
            data-website-id={UMAMI_WEBSITE_ID}
          />
        )}
      </body>
    </html>
  );
}
