'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { EmojiGroup } from '@/lib/emoji/data';
import { readRecentEmoji } from '@/lib/emoji/recent';

// ============================================================
// The full emoji picker, WhatsApp-style: search, a category bar that
// jumps to (and follows) each section, recently used first, and every
// emoji large enough to hit. The 1,870 emoji load on first open (a
// separate chunk), not with the inbox.
// ============================================================

const GROUP_ICON: Record<string, string> = {
  recent: '🕘',
  smileys: '😀',
  people: '👋',
  animals: '🐻',
  food: '🍔',
  travel: '✈️',
  activities: '⚽',
  objects: '💡',
  symbols: '❤️',
  flags: '🏳️',
};

/** Search results are capped: a one-letter query matches most of the set. */
const MAX_RESULTS = 240;

function EmojiGrid({
  items,
  onPick,
}: {
  items: [string, string][];
  onPick: (emoji: string) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-0.5">
      {items.map(([emoji, name]) => (
        <button
          key={emoji}
          type="button"
          title={name || undefined}
          aria-label={name || emoji}
          onClick={() => onPick(emoji)}
          className="flex size-9 items-center justify-center rounded-lg text-[26px] leading-none transition-transform hover:scale-110 hover:bg-muted"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null);
  const [query, setQuery] = useState('');
  const [recent] = useState<string[]>(() => readRecentEmoji());
  const [active, setActive] = useState<string>(recent.length ? 'recent' : 'smileys');
  const scrollRef = useRef<HTMLDivElement>(null);
  const sections = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    let cancelled = false;
    void import('@/lib/emoji/data').then((m) => {
      if (!cancelled) setGroups(m.EMOJI_GROUPS);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !groups) return null;
    const out: [string, string][] = [];
    for (const g of groups) {
      for (const e of g.emojis) {
        if (e[1].toLowerCase().includes(q)) out.push(e);
        if (out.length >= MAX_RESULTS) return out;
      }
    }
    return out;
  }, [query, groups]);

  const tabs = [
    ...(recent.length ? [{ id: 'recent', label: 'Recently used' }] : []),
    ...(groups ?? []).map((g) => ({ id: g.id, label: g.label })),
  ];

  const jump = (id: string) => {
    setQuery('');
    setActive(id);
    // After the search results (if any) have given way to the sections.
    requestAnimationFrame(() => {
      const el = sections.current.get(id);
      if (el && scrollRef.current) {
        scrollRef.current.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
      }
    });
  };

  // Follow the scroll: the open section is the last one whose top has
  // passed the top of the list.
  const onScroll = () => {
    const box = scrollRef.current;
    if (!box || results) return;
    let current = tabs[0]?.id;
    for (const tab of tabs) {
      const el = sections.current.get(tab.id);
      if (el && el.offsetTop <= box.scrollTop + 8) current = tab.id;
    }
    if (current && current !== active) setActive(current);
  };

  const section = (id: string, label: string, items: [string, string][]) => (
    <section
      key={id}
      ref={(el) => {
        if (el) sections.current.set(id, el);
        else sections.current.delete(id);
      }}
    >
      <p className="bg-popover/95 text-muted-foreground sticky top-0 z-10 px-1 py-1.5 text-[11px] font-medium backdrop-blur-sm">
        {label}
      </p>
      <EmojiGrid items={items} onPick={onPick} />
    </section>
  );

  return (
    <div className="flex w-80 flex-col">
      <div className="p-2 pb-1.5">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji"
            autoFocus
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary h-8 w-full rounded-lg border pr-2 pl-8 text-sm outline-none"
          />
        </div>
      </div>

      {!results && tabs.length > 0 && (
        <div className="border-border flex items-center justify-between border-b px-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => jump(tab.id)}
              title={tab.label}
              aria-label={tab.label}
              className={cn(
                'relative flex size-8 items-center justify-center text-base transition-opacity',
                active === tab.id ? 'opacity-100' : 'opacity-50 hover:opacity-100',
              )}
            >
              {GROUP_ICON[tab.id] ?? '•'}
              {active === tab.id && (
                <span className="bg-primary absolute inset-x-1 bottom-0 h-0.5 rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} onScroll={onScroll} className="relative h-72 overflow-y-auto px-1.5 pb-2">
        {!groups ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : results ? (
          results.length > 0 ? (
            <div className="pt-1.5">
              <EmojiGrid items={results} onPick={onPick} />
            </div>
          ) : (
            <p className="text-muted-foreground py-10 text-center text-xs">No emoji found</p>
          )
        ) : (
          <>
            {recent.length > 0 &&
              section(
                'recent',
                'Recently used',
                recent.map((e) => [e, ''] as [string, string]),
              )}
            {groups.map((g) => section(g.id, g.label, g.emojis))}
          </>
        )}
      </div>
    </div>
  );
}
