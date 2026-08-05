import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/hooks/use-theme";
import { ThemedToaster } from "@/components/themed-toaster";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    // What a browser tab and a Google result say. `default` is the
    // homepage; `template` wraps every page that sets its own title.
    default: "Instant — WhatsApp Marketing Automation",
    template: "%s — Instant",
  },
  description:
    "Instant by Nebkern Technology — WhatsApp marketing automation with a shared team inbox, AI agents, campaigns and pipelines, on the official WhatsApp Business API.",
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
      <body className="min-h-full bg-background text-foreground font-sans">
        <ThemeProvider>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
