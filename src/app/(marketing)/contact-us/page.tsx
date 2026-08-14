import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Clock, MessageCircle, ShieldCheck } from 'lucide-react';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { Highlight } from '@/components/lp2/decor';
import { Lp2ContactForm } from '@/components/lp2/contact-form';

export const metadata: Metadata = {
  title: { absolute: 'Contact us — Instant' },
  description:
    'Send us a message and a human will reply within one business day — questions about the product, pricing, migrating a number, or anything else.',
  robots: { index: true, follow: true },
};

// Separate from /contact, which is the compliance page: a reachable
// address, a named grievance officer, and the routing addresses Indian
// payment gateways and the DPDP Act require. That page has to stay a
// document. This one is the form, and the two link to each other.
const ASSURANCES = [
  {
    icon: Clock,
    hue: 'lemon',
    title: 'One business day',
    body: 'Every message gets a reply from a person, usually well inside that.',
  },
  {
    icon: MessageCircle,
    hue: 'mint',
    title: 'No sales sequence',
    body: 'Writing to us does not sign you up for anything. Ask a question, get an answer.',
  },
  {
    icon: ShieldCheck,
    hue: 'sky',
    title: 'Used only to reply',
    body: 'What you send is stored so we can answer it, and nothing else.',
  },
] as const;

export default function ContactUsPage() {
  return (
    <>
      <Lp2Nav />

      <main>
        <section className="bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-(--lp2-ink-soft) transition-colors hover:text-(--lp2-ink)"
            >
              <ArrowLeft className="size-4" strokeWidth={2.5} />
              Back home
            </Link>

            <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
              {/* ── Pitch ── */}
              <div>
                <h1 className="lp2-display text-4xl leading-[1.1] font-extrabold text-balance sm:text-5xl">
                  Talk to a <Highlight color="mint">real person</Highlight>
                </h1>

                <p className="mt-5 text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
                  Questions about the product, pricing, moving an existing
                  WhatsApp number across, or whether any of this fits how your
                  team already works — send it over.
                </p>

                <ul className="mt-9 space-y-5">
                  {ASSURANCES.map((a) => (
                    <li key={a.title} className="flex items-start gap-3.5">
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-(--lp2-ink) shadow-(--lp2-shadow-sm)"
                        style={{ backgroundColor: `var(--lp2-${a.hue})` }}
                      >
                        <a.icon className="size-5" strokeWidth={2.5} />
                      </span>
                      <span>
                        <span className="block text-sm font-extrabold">
                          {a.title}
                        </span>
                        <span className="mt-0.5 block text-sm leading-relaxed text-(--lp2-ink-soft)">
                          {a.body}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-9 text-sm leading-relaxed text-(--lp2-ink-soft)">
                  Looking for a specific desk — billing, privacy, abuse reports
                  — or our registered address and Grievance Officer?
                  They&rsquo;re all on{' '}
                  <Link
                    href="/contact"
                    className="font-semibold text-(--lp2-ink) underline underline-offset-2"
                  >
                    the contact details page
                  </Link>
                  .
                </p>
              </div>

              {/* ── Form ── */}
              <Lp2ContactForm />
            </div>
          </div>
        </section>
      </main>

      <Lp2Footer />
    </>
  );
}
