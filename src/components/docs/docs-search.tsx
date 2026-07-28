'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { DOCS_SEARCH_INDEX, type DocsSearchEntry } from '@/lib/docs/search-index';

/**
 * Master search bar for the docs site.
 *
 * There's no server/CMS to query — everything is hand-authored TSX
 * (see docs-components.tsx), so this searches the static index built
 * in lib/docs/search-index.ts: each page's title/description plus a
 * hand-maintained digest of its real headings and field names. That
 * means a search for something specific like "2-step PIN" or
 * "flow_token" surfaces the right page even though those words never
 * appear in the page's title.
 *
 * Client-side and small (19 entries) — a scored substring match is
 * plenty; no need for a search library for a dataset this size.
 */

function scoreEntry(entry: DocsSearchEntry, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  const title = entry.title.toLowerCase();
  const description = entry.description.toLowerCase();
  const terms = entry.terms.toLowerCase();
  const category = entry.category.toLowerCase();

  let score = 0;
  if (title === q) score += 100;
  if (title.startsWith(q)) score += 50;
  if (title.includes(q)) score += 30;
  if (description.includes(q)) score += 15;
  if (terms.includes(q)) score += 10;
  if (category.includes(q)) score += 5;

  // Multi-word queries also get credit per word, so "phone health" still
  // strongly matches a page whose exact phrase is "Phone health" while
  // "reply window session" (three separate terms) still finds something.
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    for (const w of words) {
      if (title.includes(w)) score += 8;
      if (terms.includes(w)) score += 4;
      if (description.includes(w)) score += 4;
    }
  }
  return score;
}

const MAX_RESULTS = 8;

export function DocsSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return DOCS_SEARCH_INDEX.map((entry) => ({ entry, score: scoreEntry(entry, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.entry);
  }, [query]);

  function handleQueryChange(next: string) {
    setQuery(next);
    setActiveIndex(0);
    setOpen(true);
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // "/" jumps into the search box from anywhere on the page — the
  // usual docs-site convention — as long as focus isn't already inside
  // another text input.
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key !== '/') return;
      const active = document.activeElement;
      const isTyping =
        active instanceof HTMLElement &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
      if (isTyping) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, []);

  function goTo(entry: DocsSearchEntry) {
    setOpen(false);
    setQuery('');
    router.push(entry.href);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = results[activeIndex];
      if (chosen) goTo(chosen);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-(--lp2-ink-soft)" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search the docs…"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="docs-search-results"
          aria-autocomplete="list"
          className="h-11 w-full rounded-xl border-2 border-(--lp2-ink) bg-white pr-9 pl-10 text-sm font-medium text-(--lp2-ink) outline-none placeholder:text-(--lp2-ink-soft) focus:shadow-(--lp2-shadow-sm)"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              handleQueryChange('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute top-1/2 right-3 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-(--lp2-ink-soft) hover:bg-(--lp2-cream)"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md border border-(--lp2-ink)/15 bg-(--lp2-cream) px-1.5 py-0.5 text-[10px] font-bold text-(--lp2-ink-soft)">
            /
          </kbd>
        )}
      </div>

      {open && query.trim() && (
        <div
          id="docs-search-results"
          role="listbox"
          className="absolute top-full left-0 z-30 mt-2 w-full overflow-hidden rounded-xl border-2 border-(--lp2-ink) bg-white shadow-(--lp2-shadow-sm)"
        >
          {results.length === 0 ? (
            <p className="px-4 py-4 text-sm text-(--lp2-ink-soft)">
              No results for &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1.5">
              {results.map((entry, i) => (
                <li key={entry.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => goTo(entry)}
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors',
                      i === activeIndex ? 'bg-(--lp2-cream)' : 'bg-transparent',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-bold text-(--lp2-ink)">{entry.title}</span>
                      <span className="rounded-full bg-(--lp2-grape-soft) px-2 py-0.5 text-[10px] font-bold tracking-wide text-(--lp2-grape) uppercase">
                        {entry.category}
                      </span>
                    </span>
                    <span className="line-clamp-1 text-xs text-(--lp2-ink-soft)">
                      {entry.description}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
