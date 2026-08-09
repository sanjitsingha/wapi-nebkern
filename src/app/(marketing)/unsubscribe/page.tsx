import type { Metadata } from 'next';
import Link from 'next/link';
import { MailX } from 'lucide-react';

import { Lp2Nav } from '@/components/lp2/nav';
import { Lp2Footer } from '@/components/lp2/footer';
import { UnsubscribeConfirm } from '@/components/lp2/unsubscribe-confirm';
import { verifyUnsubscribe } from '@/lib/newsletter-unsubscribe';

export const metadata: Metadata = {
  title: { absolute: 'Unsubscribe — Instant' },
  // Never indexed: every valid URL here contains somebody's email
  // address, and a search engine holding a list of them is exactly the
  // leak the signature is meant to prevent.
  robots: { index: false, follow: false },
};

// The link carries the address and its signature. Both are read on the
// server so an invalid pair never reaches the browser as something
// clickable.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const { e, t } = await searchParams;
  const email = (e ?? '').trim().toLowerCase();
  const token = (t ?? '').trim();
  const valid = verifyUnsubscribe(email, token);

  return (
    <>
      <Lp2Nav />

      <main>
        <section className="bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-xl px-4 sm:px-6">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-lemon) shadow-(--lp2-shadow-sm)">
              <MailX className="size-6" strokeWidth={2.5} />
            </span>

            <h1 className="lp2-display mt-6 text-4xl leading-[1.1] font-extrabold text-balance">
              Newsletter unsubscribe
            </h1>

            <div className="mt-8">
              {valid ? (
                <UnsubscribeConfirm email={email} token={token} />
              ) : (
                <div className="rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-coral-soft) p-8 shadow-(--lp2-shadow)">
                  <p className="text-base leading-relaxed font-medium">
                    This unsubscribe link isn&rsquo;t valid.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-(--lp2-ink-soft)">
                    Links expire nothing and never change, so this usually means
                    the address was edited in the URL, or the link was broken
                    across two lines by an email client. Try clicking it again
                    from the original email, or{' '}
                    <Link
                      href="/contact-us"
                      className="font-semibold text-(--lp2-ink) underline underline-offset-2"
                    >
                      write to us
                    </Link>{' '}
                    and we&rsquo;ll take you off the list by hand.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <Lp2Footer />
    </>
  );
}
