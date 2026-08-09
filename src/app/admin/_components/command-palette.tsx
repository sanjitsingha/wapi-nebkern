'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

// ============================================================
// ⌘K — jump anywhere.
//
// The panel is nineteen pages and one tenant list that grows forever.
// Finding a specific account meant Accounts → scroll or Ctrl+F → click;
// this makes it three keystrokes.
//
// COSTS NOTHING TO RUN. The tenant list is handed down from the layout,
// which already reads it from the shared cache — the palette issues no
// request of its own, at open time or per keystroke. That is why the
// match is a plain substring scan in the browser rather than a query.
// ============================================================

export interface PaletteTarget {
  id: string;
  name: string;
}

interface Item {
  label: string;
  sub?: string;
  href: string;
  group: string;
}

export function CommandPalette({
  pages,
  accounts,
}: {
  pages: { label: string; href: string; group: string }[];
  accounts: PaletteTarget[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global shortcut. `metaKey || ctrlKey` so it works on both, and the
  // preventDefault stops Chrome's own Ctrl+K (search-from-address-bar).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const items = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase();

    const pageItems: Item[] = pages.map((p) => ({
      label: p.label,
      href: p.href,
      group: p.group,
    }));

    // Tenants are only listed once you type. Unfiltered, a hundred
    // accounts would bury the nineteen pages you use every day.
    const accountItems: Item[] = needle
      ? accounts
          .filter((a) => a.name.toLowerCase().includes(needle))
          .slice(0, 8)
          .map((a) => ({
            label: a.name,
            sub: a.id.slice(0, 8),
            href: `/admin/accounts/${a.id}`,
            group: 'Tenant',
          }))
      : [];

    const matched = needle
      ? pageItems.filter(
          (p) =>
            p.label.toLowerCase().includes(needle) ||
            p.group.toLowerCase().includes(needle)
        )
      : pageItems;

    return [...matched, ...accountItems];
  }, [q, pages, accounts]);

  // Keep the cursor in range as the list shrinks under typing.
  const active = Math.min(i, Math.max(items.length - 1, 0));

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    setI(0);
    router.push(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/50"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="bg-card relative w-full max-w-lg overflow-hidden rounded-sm border border-(--admin-line-strong) shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-(--admin-line) px-3">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setI(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setI((v) => Math.min(v + 1, items.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setI((v) => Math.max(v - 1, 0));
              } else if (e.key === 'Enter' && items[active]) {
                e.preventDefault();
                go(items[active].href);
              }
            }}
            placeholder="Jump to a page or tenant…"
            className="text-foreground placeholder:text-muted-foreground h-11 w-full bg-transparent text-sm outline-none"
          />
          <kbd className="admin-label text-muted-foreground border border-(--admin-line) px-1.5 py-0.5">
            esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {items.length === 0 && (
            <p className="text-muted-foreground px-3 py-6 text-center text-xs">
              Nothing matches “{q}”.
            </p>
          )}
          {items.map((item, idx) => (
            <button
              key={`${item.href}-${item.label}`}
              type="button"
              onMouseEnter={() => setI(idx)}
              onClick={() => go(item.href)}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2 text-left text-sm',
                idx === active ? 'bg-primary-soft' : 'hover:bg-muted/60'
              )}
            >
              <span className="admin-label text-muted-foreground w-16 shrink-0 truncate">
                {item.group}
              </span>
              <span className="text-foreground min-w-0 flex-1 truncate">
                {item.label}
              </span>
              {item.sub && (
                <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
                  {item.sub}
                </span>
              )}
              {idx === active && (
                <CornerDownLeft className="text-muted-foreground size-3.5 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
