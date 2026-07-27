import type { CSSProperties } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Blob, type Lp2Hue } from './decor';
import { Lp2Nav } from './nav';
import { Lp2Footer } from './footer';

// ============================================================
// Shared shell for the /lp-2 legal pages.
//
// All five policies (privacy, terms, refunds, acceptable use, contact)
// are the same page with different words, so they're structured data
// rendered by one component. That's not just DRY: legal pages have to
// agree with each other, and the fastest way to end up with a Terms
// page that contradicts the Privacy page is to hand-build each one.
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
    <div className="flex items-start gap-3 rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-coral-soft) p-4 shadow-(--lp2-shadow-sm)">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border-2 border-(--lp2-ink) bg-(--lp2-coral)">
        <AlertTriangle className="size-4 text-white" strokeWidth={3} />
      </span>
      <p className="text-sm leading-relaxed font-semibold">
        <span className="font-extrabold">Template — not yet legal advice.</span>{' '}
        This document is a starting point drafted for a WhatsApp CRM on the
        official Business API. Fill in every highlighted placeholder and have
        a qualified lawyer review it against your jurisdiction before you
        publish or take payments. Delete this banner when that&apos;s done.
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
              className="mt-5 rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-mint) px-4 py-3 text-sm leading-relaxed font-semibold"
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
              ordered && 'list-inside list-decimal',
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
  kicker,
  updated,
  intro,
  sections,
  hue = 'sky',
}: {
  title: string;
  /** One line above the title — what this document is for. */
  kicker: string;
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
        {/* ── Header band ── */}
        <section className="relative -mt-19 overflow-hidden border-b-2 border-(--lp2-ink) pt-19 sm:-mt-20 sm:pt-20">
          <Blob
            color={hue}
            className="-top-32 -right-24 size-120 opacity-50"
          />
          <Blob
            color="lemon"
            className="-bottom-32 -left-24 size-96 opacity-40"
            style={{ animationDelay: '-9s' }}
          />

          <div className="relative mx-auto max-w-4xl px-4 pt-12 pb-14 sm:px-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-(--lp2-ink-soft) transition-colors hover:text-(--lp2-ink)"
            >
              <ArrowLeft className="size-4" strokeWidth={3} />
              Back home
            </Link>

            <span
              className="mt-6 inline-flex rounded-full border-2 border-(--lp2-ink) px-3.5 py-1.5 text-xs font-extrabold tracking-wide uppercase shadow-(--lp2-shadow-sm)"
              style={
                {
                  backgroundColor: `var(--lp2-${hue})`,
                  transform: 'rotate(-1.5deg)',
                } as CSSProperties
              }
            >
              {kicker}
            </span>

            <h1 className="lp2-display mt-5 text-4xl font-extrabold text-balance sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-pretty text-(--lp2-ink-soft)">
              {intro}
            </p>
            <p className="mt-5 inline-flex rounded-full border-2 border-(--lp2-ink) bg-white px-3 py-1 text-xs font-bold">
              Last updated: {updated}
            </p>
          </div>
        </section>

        {/* ── Body ── */}
        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[16rem_1fr] lg:gap-14">
            {/* Contents. Sticky on desktop only — these documents run
                long and jumping between clauses is the main way anyone
                actually reads them. */}
            <nav
              aria-label="On this page"
              className="lg:sticky lg:top-24 lg:self-start"
            >
              <p className="text-xs font-extrabold tracking-wide uppercase">
                On this page
              </p>
              <ol className="mt-4 space-y-1.5">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="flex gap-2.5 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-(--lp2-ink-soft) transition-colors hover:bg-(--lp2-cream) hover:text-(--lp2-ink)"
                    >
                      <span className="text-(--lp2-ink)/35">{i + 1}.</span>
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="min-w-0">
              <DraftNotice />

              <div className="mt-10 space-y-12">
                {sections.map((s, i) => (
                  // `scroll-mt` clears the sticky nav pill — without it
                  // an anchor jump parks the heading underneath it.
                  <section key={s.id} id={s.id} className="scroll-mt-28">
                    <h2 className="lp2-display flex items-start gap-3 text-2xl font-extrabold">
                      <span
                        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border-2 border-(--lp2-ink) text-sm shadow-[2px_2px_0_var(--lp2-ink)]"
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
