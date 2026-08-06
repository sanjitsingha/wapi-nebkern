import Link from 'next/link';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

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
// PLACEHOLDERS: policy text uses {{TOKEN}} markers for facts only the
// business owner knows (legal entity name, address, contact email).
// They render highlighted so they're impossible to miss — see
// `PLACEHOLDERS` below for the full list and fill them in before this
// goes anywhere near a customer.
// ============================================================

/**
 * Every token that may appear in policy copy, with the prompt shown on
 * the page until it's replaced. Keep this in sync with the tokens
 * actually used — an unknown token renders as-is, which is loud enough
 * to catch in review but not something to rely on.
 */
const PLACEHOLDERS: Record<string, string> = {
  COMPANY: 'YOUR LEGAL ENTITY NAME',
  ADDRESS: 'YOUR REGISTERED ADDRESS',
  EMAIL: 'YOUR SUPPORT EMAIL',
  PHONE: 'YOUR PHONE NUMBER',
  CITY: 'YOUR CITY',
  GRIEVANCE: 'GRIEVANCE OFFICER NAME',
  // Infrastructure facts. The subprocessor list and security policy name
  // real vendors where the code proves them (Supabase, Meta, Razorpay,
  // the AI providers) — the host is a deployment choice the code can't
  // know, so it stays a placeholder rather than a plausible guess. A
  // subprocessor list that names the wrong host is worse than one that
  // visibly needs filling in.
  //
  // REGION used to live here too. It is now a known fact — Mumbai,
  // India (ap-south-1), as of the August 2026 move off Tokyo — so it is
  // written into the copy directly. See docs/migrating-databases.md.
  HOSTING: 'YOUR HOSTING PROVIDER',
  SECURITY_EMAIL: 'YOUR SECURITY CONTACT EMAIL',
};

export type LegalBlock =
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  /** Callout for the one or two points per policy that actually get
   *  disputed — worth pulling out of the wall of prose. */
  | { note: string };

export interface LegalSection {
  /** Anchor id, also the target of the sidebar contents links. */
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

/* ─── Placeholder-aware text ──────────────────────────────────────── */

/**
 * Splits copy on {{TOKEN}} and renders each one as a highlighted chip.
 *
 * Deliberately visual rather than a silent default: a privacy policy
 * that quietly says "we" where a company name belongs looks finished
 * and ships broken. This looks unfinished until it is finished.
 */
function Text({ children }: { children: string }) {
  const parts = children.split(/(\{\{[A-Z_]+\}\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\{\{([A-Z_]+)\}\}$/.exec(part);
        if (!m) return part;
        const label = PLACEHOLDERS[m[1]] ?? m[1];
        return (
          <span
            key={i}
            className="mx-0.5 rounded-md border-2 border-dashed border-(--lp2-ink)/40 bg-(--lp2-lemon) px-1.5 py-px text-[0.85em] font-extrabold tracking-wide whitespace-nowrap"
          >
            {label}
          </span>
        );
      })}
    </>
  );
}

/* ─── Draft notice ────────────────────────────────────────────────── */

/**
 * The "this is a template" banner. Prominent on purpose, and the first
 * thing to delete once a lawyer has signed off — it renders on every
 * legal page, so removing it here removes it everywhere.
 */
function DraftNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-(--lp2-coral) bg-(--lp2-coral-soft)/60 p-4">
      <AlertTriangle
        className="mt-0.5 size-4 shrink-0 text-(--lp2-coral)"
        strokeWidth={2.5}
      />
      <p className="text-sm leading-relaxed font-medium">
        <span className="font-extrabold">Template — not yet legal advice.</span>{' '}
        This document is a starting point drafted for a WhatsApp CRM on the
        official Business API. Fill in every highlighted placeholder and have a
        qualified lawyer review it against your jurisdiction before you publish
        or take payments. Delete this banner when that&apos;s done.
      </p>
    </div>
  );
}

/* ─── Blocks ──────────────────────────────────────────────────────── */

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
              <DraftNotice />

              <div className="mt-10 space-y-12">
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
