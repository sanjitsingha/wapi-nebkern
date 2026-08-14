'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Newspaper, Search, X } from 'lucide-react';

import { Sparkle } from './decor';
import { postHue, TagPill } from './blog-bits';

// ============================================================
// /lp-2 blog index — two bands:
//
//   1. Header, on the page's cream backdrop with blobs: the title and a
//      search box. Typing pops a typeahead dropdown of matching posts.
//   2. The card grid, on white, always showing every post.
//
// Client component because the search dropdown filters live. The server
// page hands posts down already flattened to `BlogListItem` (dates
// pre-formatted), so this file never imports the data layer — no
// Supabase client in the blog route's client bundle.
// ============================================================

export interface BlogListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  tags: string[];
  /** Pre-formatted on the server (e.g. "July 19, 2026"). */
  dateLabel: string;
}

export function Lp2BlogBrowser({ posts }: { posts: BlogListItem[] }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // Dropdown matches only — the grid below always shows everything.
  // Capped so the dropdown never grows into a full page of its own.
  const matches = useMemo(() => {
    if (!q) return [];
    return posts
      .filter((p) =>
        [p.title, p.excerpt ?? '', ...p.tags]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 6);
  }, [posts, q]);

  return (
    <>
      {/* ── 1. Header ──
          Plain flat background (no gradient/blobs). `z-20` so the search
          dropdown, which overflows into the white band below, paints
          above it. No overflow-hidden here, so the dropdown can escape. */}
      <section className="relative z-20 -mt-19 bg-(--lp2-sky-soft) pt-19 sm:-mt-20 sm:pt-20">
        <div className="relative mx-auto max-w-3xl px-4 pt-16 pb-16 text-center sm:px-6 sm:pt-20 sm:pb-20">
          <h1 className="lp2-display mx-auto max-w-2xl text-3xl leading-[1.12] font-extrabold text-balance sm:text-[2.6rem]">
            Insights to scale your brand with WhatsApp automation &amp;
            AI-powered business intelligence
          </h1>

          {/* Search + typeahead dropdown. `text-left` resets the
              centred header for the input and its results. No border or
              shadow — just a filled pill. */}
          <div className="relative mx-auto mt-12 max-w-xl text-left">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-(--lp2-ink-soft)"
              strokeWidth={2.5}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles…"
              aria-label="Search articles"
              className="h-13 w-full rounded-full border-2 border-(--lp2-ink)/15 bg-white pr-12 pl-12 text-base font-semibold outline-none placeholder:font-medium placeholder:text-(--lp2-ink-soft) focus:border-(--lp2-ink)/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-3 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-(--lp2-ink-soft) transition-colors hover:bg-(--lp2-cream) hover:text-(--lp2-ink)"
              >
                <X className="size-4" strokeWidth={2.75} />
              </button>
            )}

            {q && (
              <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-white">
                {matches.length === 0 ? (
                  <p className="px-4 py-5 text-sm font-semibold text-(--lp2-ink-soft)">
                    No articles match &ldquo;{query}&rdquo;.
                  </p>
                ) : (
                  <ul className="max-h-96 divide-y-2 divide-(--lp2-ink)/10 overflow-y-auto">
                    {matches.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/blog/${p.slug}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-(--lp2-cream)"
                        >
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                            style={{
                              backgroundColor: `var(--lp2-${postHue(p.slug)}-soft)`,
                            }}
                          >
                            <Newspaper className="size-4" strokeWidth={2.5} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">
                              {p.title}
                            </span>
                            <span className="block text-xs font-semibold text-(--lp2-ink-soft)">
                              {p.dateLabel}
                            </span>
                          </span>
                          <ArrowRight
                            className="size-4 shrink-0 text-(--lp2-ink-soft)"
                            strokeWidth={2.75}
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 2. Cards (white, generous margins) ── */}
      <section className="relative z-10 border-t-2 border-(--lp2-ink) bg-white px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-7xl">
          {posts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <Card key={p.id} post={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/* ─── Card (uniform) ──────────────────────────────────────────────── */

function Card({ post }: { post: BlogListItem }) {
  const hue = postHue(post.slug);

  return (
    // A slight ink outline (15% opacity), no shadow: the card is a soft
    // white box with a full-bleed coloured cover up top, divided from
    // the text by the same light rule.
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-[1.75rem] border-2 border-(--lp2-ink)/15 bg-white transition-transform duration-200 hover:-translate-y-1"
    >
      <div
        className="relative aspect-video overflow-hidden border-b-2 border-(--lp2-ink)/15"
        style={{ backgroundColor: `var(--lp2-${hue}-soft)` }}
      >
        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageUrl}
            alt=""
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          // No cover — a coloured panel with the post's own hue and a
          // couple of sparkles. Deterministic per slug, so a post keeps
          // its colour between the card and its own page.
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="flex size-16 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: `var(--lp2-${hue})`,
                transform: 'rotate(-6deg)',
              }}
            >
              <Newspaper className="size-7" strokeWidth={2.5} />
            </span>
            <Sparkle color={hue} className="absolute top-5 right-6 size-5" />
            <Sparkle color="lemon" className="absolute bottom-6 left-7 size-4" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-2">
          {post.tags.slice(0, 2).map((t) => (
            <TagPill key={t} tag={t} />
          ))}
          <span className="text-xs font-bold text-(--lp2-ink-soft)">
            {post.dateLabel}
          </span>
        </div>

        <h2 className="lp2-display mt-3 text-xl font-extrabold text-balance">
          {post.title}
        </h2>

        {post.excerpt && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-(--lp2-ink-soft)">
            {post.excerpt}
          </p>
        )}

        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-extrabold">
          Read article
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-1"
            strokeWidth={3}
          />
        </span>
      </div>
    </Link>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-[1.75rem] border-2 border-dashed border-(--lp2-ink)/40 bg-white px-6 py-16 text-center">
      <span
        className="flex size-14 items-center justify-center rounded-2xl border-2 border-(--lp2-ink) bg-(--lp2-lemon) shadow-(--lp2-shadow-sm)"
        style={{ transform: 'rotate(-6deg)' }}
      >
        <Newspaper className="size-6" strokeWidth={2.5} />
      </span>
      <p className="lp2-display mt-5 text-xl font-extrabold">
        Nothing published yet
      </p>
      <p className="mt-2 text-sm text-(--lp2-ink-soft)">
        We&apos;re writing. Check back soon — or start your trial and skip
        straight to the product.
      </p>
    </div>
  );
}
