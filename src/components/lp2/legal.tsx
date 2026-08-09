import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Lp2Hue } from './decor';
import { Lp2Nav } from './nav';
import { Lp2Footer } from './footer';
import { LegalNav } from './legal-nav';

// ============================================================
// Shared shell for the legal pages — the eleven policies in
// `legal-links.ts`, plus contact.
//
// Same nav/footer as the rest of the site, but deliberately restrained
// in the body: no blobs, no rotated stickers, no hard offset shadows,
// no coloured banding. A policy someone might need to read carefully —
// or a payment gateway's reviewer might screenshot — should read as a
// document, not a marketing page. The per-section hue survives only as
// a soft tint behind the section numbers.
//
// Every policy is the same page with different words, so they're
// structured data rendered by one component. That's not just DRY: legal
// pages have to agree with each other, and the fastest way to end up
// with a Terms page that contradicts the Privacy page is to hand-build
// each one.
//
// LEGAL_FACTS: policy text uses {{TOKEN}} markers so the same business
// facts render consistently across every legal document.
// ============================================================

/* ─── Blocks ──────────────────────────────────────────────────────── */

const LEGAL_FACTS: Record<string, string> = {
  COMPANY: 'Nebkern Technology',
  ADDRESS: 'Kolkata, West Bengal, India',
  EMAIL: 'itsmesanjitsingh@gmail.com',
  PHONE: '+91 7708601814',
  CITY: 'Kolkata',
  GRIEVANCE: 'Sanjit Singh',
  HOSTING:
    'Hostinger for application hosting, with Cloudflare R2 for media delivery',
  SECURITY_EMAIL: 'itsmesanjitsingh@gmail.com',
};

export type LegalBlock =
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  | { note: string };

export interface LegalSection {
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

function Text({ children }: { children: string }) {
  const parts = children.split(/(\{\{[A-Z_]+\}\})/g);
  return (
    <>
      {parts.map((part) => {
        const m = /^\{\{([A-Z_]+)\}\}$/.exec(part);
        if (!m) return part;
        return LEGAL_FACTS[m[1]] ?? `[[${m[1]}]]`;
      })}
    </>
  );
}

function Blocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if ('p' in b) {
          return (
            <p key={i} className="mt-4 leading-relaxed text-(--lp2-ink-soft)">
              <Text>{b.p}</Text>
            </p>
          );
        }
        if ('note' in b) {
          return (
            <p
              key={i}
              className="mt-5 rounded-xl border border-(--lp2-grass)/30 bg-(--lp2-mint)/50 px-4 py-3 text-sm leading-relaxed font-medium"
            >
              <Text>{b.note}</Text>
            </p>
          );
        }
        const ordered = 'ol' in b;
        const items = ordered ? b.ol : b.ul;
        const List = ordered ? 'ol' : 'ul';
        return (
          <List
            key={i}
            className={cn(
              'mt-4 space-y-2 pl-1 text-(--lp2-ink-soft)',
              ordered && 'list-inside list-decimal'
            )}
          >
            {items.map((item, j) => (
              <li
                key={j}
                className={cn('leading-relaxed', !ordered && 'flex gap-3')}
              >
                {!ordered && (
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-(--lp2-ink)/40"
                  />
                )}
                <span>
                  <Text>{item}</Text>
                </span>
              </li>
            ))}
          </List>
        );
      })}
    </>
  );
}

/* ─── The page ────────────────────────────────────────────────────── */

export function LegalPage({
  title,
  updated,
  intro,
  sections,
  hue = 'sky',
}: {
  title: string;
  /** Human-readable "last updated" date. Change it when you change the
   *  text; a stale date on a policy is its own small liability. */
  updated: string;
  intro: string;
  sections: LegalSection[];
  hue?: Lp2Hue;
}) {
  return (
    <>
      <Lp2Nav />

      <main>
        {/* ── Header band ──
            No blobs, no rotation, no sticker shadow, and no coloured
            rule across the top — a policy page reads as a document, and
            a stripe that changes colour per document just makes eleven
            of them look like eleven unrelated sites. The hue survives
            only on the section numbers below. */}
        <section className="border-b border-(--lp2-ink)/10 pt-8 sm:pt-10">
          <div className="mx-auto max-w-4xl px-4 pt-4 pb-14 sm:px-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-(--lp2-ink-soft) transition-colors hover:text-(--lp2-ink)"
            >
              <ArrowLeft className="size-4" strokeWidth={2.5} />
              Back home
            </Link>

            <h1 className="lp2-display mt-6 text-4xl font-extrabold text-balance sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-pretty text-(--lp2-ink-soft)">
              {intro}
            </p>
            <p className="mt-5 inline-flex rounded-full border border-(--lp2-ink)/15 bg-(--lp2-paper) px-3 py-1 text-xs font-semibold text-(--lp2-ink-soft)">
              Last updated: {updated}
            </p>
          </div>
        </section>

        {/* ── Body ── */}
        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[16rem_1fr] lg:gap-14">
            {/* The other documents, not this one's headings. Sticky on
                desktop, parked clear of the nav: the bar is flush at
                top-0 and 64px tall, so top-24 leaves a comfortable gap.
                (It was top-32 when the nav was a floating pill sitting
                12px down — that version's bottom edge landed at ~92px.) */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <LegalNav />
            </div>

            <div className="min-w-0">
              <div className="space-y-12">
                {sections.map((s, i) => (
                  // `scroll-mt` clears the sticky nav pill — without it
                  // an anchor jump parks the heading underneath it.
                  <section key={s.id} id={s.id} className="scroll-mt-28">
                    <h2 className="lp2-display flex items-start gap-3 text-2xl font-extrabold">
                      <span
                        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                        style={{ backgroundColor: `var(--lp2-${hue}-soft)` }}
                      >
                        {i + 1}
                      </span>
                      {s.heading}
                    </h2>
                    <div className="mt-2 pl-0 sm:pl-11">
                      <Blocks blocks={s.blocks} />
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Lp2Footer />
    </>
  );
}
