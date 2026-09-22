'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Newspaper, Search, X } from 'lucide-react';

import { Magnetic } from '@/components/ui/magnetic-button';
import { WaPill } from '@/components/wa/ui';
import { Sparkle } from './decor';
import { postHue } from './blog-bits';
import { ShareButtons } from './share-buttons';

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
          Plain flat white (no gradient/blobs), continuous with the posts
          band below rather than a tinted strip above it. `z-20` so the
          search dropdown, which overflows into that band, paints above
          it. No overflow-hidden here, so the dropdown can escape. */}
      <section className="relative z-20 -mt-19 bg-white pt-19 sm:-mt-20 sm:pt-20">
        <div className="relative mx-auto max-w-3xl px-4 pt-16 pb-16 text-center sm:px-6 sm:pt-20 sm:pb-20">
          {/* Says what the page is and stops. The longer pitch it used to
              carry lives on in the page description search results show. */}
          <h1 className="lp2-display mx-auto max-w-2xl text-3xl leading-[1.12] font-extrabold sm:text-[2.6rem]">
            The Instant blog
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
              className="h-13 w-full rounded-full border-2 border-(--lp2-ink)/15 bg-white pr-12 pl-12 text-lg font-semibold outline-none placeholder:font-medium placeholder:text-(--lp2-ink-soft) focus:border-(--lp2-ink)/30"
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
                  <p className="px-4 py-5 text-lg font-semibold text-(--lp2-ink-soft)">
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
                            <span className="block text-base font-semibold text-(--lp2-ink-soft)">
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

      {/* ── 2. Cards (white, generous margins) ──
          No rule along the top: the change of background from the header
          band to white is the only division the two sections need. */}
      <section className="relative z-10 bg-white px-4 py-20 sm:px-6 sm:py-28">
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
  const href = `/blog/${post.slug}`;

  return (
    // A slight ink outline (15% opacity), no shadow: the card is a soft
    // white box with a full-bleed coloured cover up top, divided from
    // the text by the same light rule.
    //
    // An <article> rather than one card-wide link, because the Read more
    // button is a link itself and an anchor cannot nest inside another.
    // The title and the button are the two real links; the cover is a
    // third for the mouse, hidden from screen readers and the tab order
    // so the same post is not announced three times.
    <article className="group flex flex-col overflow-hidden rounded-2xl border-2 border-(--lp2-ink)/15 bg-white transition-transform duration-200 hover:-translate-y-1">
      <Link
        href={href}
        aria-hidden
        tabIndex={-1}
        className="relative block aspect-video overflow-hidden border-b-2 border-(--lp2-ink)/15"
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
      </Link>

      <div className="flex flex-1 flex-col p-6">
        {/* Date alone now — the category pills came off. */}
        <span className="text-base font-bold text-(--lp2-ink-soft)">
          {post.dateLabel}
        </span>

        <h2 className="lp2-display mt-3 text-xl font-extrabold text-balance">
          <Link href={href} className="outline-none">
            {/* The green rule grows in from the left while the card is
                hovered or the title has keyboard focus — the same device
                as the landing page's blog cards. */}
            <span className="bg-[linear-gradient(var(--lp2-grass),var(--lp2-grass))] bg-size-[0%_2px] bg-bottom-left bg-no-repeat pb-1 transition-[background-size] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-size-[100%_2px] group-focus-within:bg-size-[100%_2px] motion-reduce:transition-none">
              {post.title}
            </span>
          </Link>
        </h2>

        {post.excerpt && (
          <p className="mt-2 line-clamp-2 text-lg leading-relaxed text-(--lp2-ink-soft)">
            {post.excerpt}
          </p>
        )}

        {/* mt-auto pins this row to the card's foot, so buttons line up
            across a row of cards whatever the length of the copy above:
            Read more on the left, ways to share it on the right. */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-6">
          <Magnetic radius="full">
            <WaPill href={href}>
              Read more
              {/* "Read more" on its own is the same link on every card to
                  anyone reading the page by its links alone. */}
              <span className="sr-only">: {post.title}</span>
            </WaPill>
          </Magnetic>

          {/* `path`, not the current page: these share the post the card
              points at, not the index they sit on. */}
          <ShareButtons title={post.title} path={href} />
        </div>
      </div>
    </article>
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
      <p className="mt-2 text-lg text-(--lp2-ink-soft)">
        We&apos;re writing. Check back soon — or start your trial and skip
        straight to the product.
      </p>
    </div>
  );
}
