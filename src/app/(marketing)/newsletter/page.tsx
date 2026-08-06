import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Highlight } from '@/components/lp2/decor';
import { Lp2NewsletterForm } from '@/components/lp2/newsletter-form';

export const metadata: Metadata = {
  title: { absolute: 'Newsletter — Instant' },
  description:
    'One email a month on WhatsApp marketing, AI agents and what actually moves the needle for teams selling on chat.',
  robots: { index: true, follow: true },
};

// A page of its own rather than a strip in the footer: a signup box
// wedged between eleven policy links converts like one, and this is
// somewhere a link in an email or a social bio can point at.
export default function NewsletterPage() {
  return (
    <>
      <Lp2Nav />

      <main>
        <section className="bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-(--lp2-ink-soft) transition-colors hover:text-(--lp2-ink)"
            >
              <ArrowLeft className="size-4" strokeWidth={2.5} />
              Back home
            </Link>

            <span className="mt-8 inline-flex size-12 items-center justify-center rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-lemon) shadow-(--lp2-shadow-sm)">
              <Mail className="size-6" strokeWidth={2.5} />
            </span>

            <h1 className="lp2-display mt-6 text-4xl leading-[1.1] font-extrabold text-balance sm:text-5xl">
              One email a month.{' '}
              <Highlight color="mint">Worth opening.</Highlight>
            </h1>

            <p className="mt-5 text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
              What we learn running WhatsApp for teams that sell on it — the
              campaigns that worked, the automations that quietly earn their
              keep, and the Meta policy changes worth knowing about before they
              bite.
            </p>

            <div className="mt-9">
              <Lp2NewsletterForm />
            </div>
          </div>
        </section>
      </main>

      <Lp2Footer />
    </>
  );
}
