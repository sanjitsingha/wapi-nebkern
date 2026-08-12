import type { Metadata } from 'next';
import { Lock, Printer, Zap } from 'lucide-react';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2QrTool } from '@/components/lp2/qr-tool';
import { Lp2Cta } from '@/components/lp2/cta';
import { Lp2Footer } from '@/components/lp2/footer';
import { Highlight } from '@/components/lp2/decor';

// ============================================================
// /qr-generator — the free WhatsApp QR tool.
//
// Moved out from behind the login, where it was /qr-code inside the
// dashboard. Two reasons it belongs here: it needs no account to be
// useful, and "whatsapp qr code generator" is something people search
// for — a working free tool is a better front door than a feature page
// describing one.
//
// The signed-in version pinned the destination to the account's own
// connected number. Out here the visitor types it; see the note in
// `qr-tool.tsx`.
// ============================================================

export const metadata: Metadata = {
  title: {
    absolute: 'Free WhatsApp QR Code Generator — with a pre-filled message',
  },
  description:
    'Turn any WhatsApp number into a scannable QR code, free. Add a message that is already typed when someone scans, then download it as PNG or SVG for posters, packaging and shop windows. Runs entirely in your browser.',
  alternates: { canonical: '/qr-generator' },
  robots: { index: true, follow: true },
  openGraph: {
    siteName: 'Instant',
    type: 'website',
    title: 'Free WhatsApp QR Code Generator',
    description:
      'Turn any WhatsApp number into a scannable QR code with a pre-filled message. Download as PNG or SVG.',
  },
};

// Fully static — the tool is a client component and talks to nothing.

const POINTS = [
  {
    icon: Zap,
    hue: 'lemon',
    title: 'Opens the chat, already typed',
    body: 'A scan opens WhatsApp with your number in the "to" field and your message ready to send. One tap from them, no typing.',
  },
  {
    icon: Printer,
    hue: 'sky',
    title: 'Print-ready PNG and SVG',
    body: 'Downloads carry the full quiet zone and come at 1024px, or as vector — so they still scan blown up on a poster or a shop window.',
  },
  {
    icon: Lock,
    hue: 'grass',
    title: 'Nothing leaves your browser',
    body: 'The code is generated on your device. Your number and message are never sent to us, stored, or logged.',
  },
] as const;

export default function QrGeneratorPage() {
  return (
    <>
      <Lp2Nav />
      <main>
        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="lp2-display text-3xl leading-[1.08] font-extrabold text-balance sm:text-[2.75rem]">
                Free WhatsApp{' '}
                <Highlight color="grass" className="mx-[0.1em] text-white">
                  QR code
                </Highlight>{' '}
                generator
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
                Put your WhatsApp on a poster, a menu, a package or a shop
                window. Someone scans, and the chat opens with your message
                already written.
              </p>
            </div>

            <div className="mt-14">
              <Lp2QrTool />
            </div>
          </div>
        </section>

        <section className="border-t border-(--lp2-ink)/10 bg-(--lp2-cream) py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-3">
            {POINTS.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border-2 border-(--lp2-ink) bg-white p-6"
              >
                <span
                  aria-hidden
                  className="flex size-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `var(--lp2-${p.hue})` }}
                >
                  <p.icon
                    className={p.hue === 'lemon' ? 'size-5' : 'size-5 text-white'}
                    strokeWidth={2.75}
                  />
                </span>
                <h2 className="mt-4 text-base font-extrabold">{p.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-(--lp2-ink-soft)">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <Lp2Cta />
      </main>
      <Lp2Footer />
    </>
  );
}
