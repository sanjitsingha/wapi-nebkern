'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Columns3,
  Combine,
  PanelLeft,
  PanelTop,
  Rows3,
  Settings2,
  Split,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils';

// ============================================================
// The two things that belong AT what they act on, rather than in the
// toolbar at the top of the page: the link box, which opens on the
// words being linked, and the table controls, which hang off the
// table's own corner.
//
// Both are `position: fixed` and positioned from a viewport rect. Fixed
// rather than absolute because the editor sits inside a sticky band and
// a scrolling column — an absolutely positioned panel would be measured
// against whichever ancestor happens to be positioned, and clipped by
// the first one that scrolls.
//
// The cost of fixed is that nothing moves it when the page scrolls, so
// both listen for scroll and resize and re-measure. `capture: true` on
// the scroll listener catches scrolling inside the editor's own
// containers, which does not bubble.
// ============================================================

type Rect = { top: number; bottom: number; left: number; right: number };

const PANEL =
  'border-border bg-popover text-popover-foreground fixed z-50 rounded-lg border shadow-lg';

/** Keeps a panel on screen: never past the right edge, never off the
 *  left, and flipped above its anchor when it would fall off the
 *  bottom. */
function place(rect: Rect, width: number, height: number) {
  const gap = 8;
  const left = Math.min(
    Math.max(gap, rect.left),
    Math.max(gap, window.innerWidth - width - gap)
  );
  const below = rect.bottom + gap;
  const top =
    below + height > window.innerHeight - gap
      ? Math.max(gap, rect.top - height - gap)
      : below;
  return { top, left };
}

/**
 * Re-runs `measure` now, on scroll, and on resize, and hands back what
 * it returns — null when there is nothing to anchor to.
 */
function useTrackedRect(
  measure: () => Rect | null,
  deps: React.DependencyList
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(measure, deps);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const update = () => setRect(run());
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [run]);

  return rect;
}

/* ─── Link ───────────────────────────────────────────────────── */

/**
 * The URL box, opened on the selected words.
 *
 * `anchor` is captured by the caller at the moment the button is
 * pressed, because focusing this input collapses the document selection
 * the rect was measured from.
 */
export function LinkPopover({
  anchor,
  initialHref,
  hasLink,
  onSubmit,
  onRemove,
  onClose,
}: {
  anchor: Rect;
  initialHref: string;
  hasLink: boolean;
  onSubmit: (href: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [href, setHref] = useState(initialHref);
  const valid = /^https?:\/\//i.test(href.trim()) || href.trim().startsWith('/');

  const WIDTH = 320;
  const { top, left } = place(anchor, WIDTH, 96);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Click-away. Transparent, under the panel, over everything else. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />
      <div
        role="dialog"
        aria-label={hasLink ? 'Edit link' : 'Add link'}
        style={{ top, left, width: WIDTH }}
        className={cn(PANEL, 'p-2')}
      >
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) {
                e.preventDefault();
                onSubmit(href.trim());
                onClose();
              }
            }}
            placeholder="https://example.com  or  /pricing"
            aria-label="Links to"
            className="border-border bg-muted focus-visible:border-primary h-8 min-w-0 flex-1 rounded-md border px-2 text-xs outline-none"
          />
          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              onSubmit(href.trim());
              onClose();
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 shrink-0 cursor-pointer rounded-md px-2.5 text-xs font-semibold disabled:opacity-40"
          >
            {hasLink ? 'Update' : 'Add'}
          </button>
          {hasLink && (
            <button
              type="button"
              title="Remove link"
              aria-label="Remove link"
              onClick={() => {
                onRemove();
                onClose();
              }}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
        <p className="text-muted-foreground mt-1.5 px-0.5 text-[11px]">
          An external address, or a path on this site starting with /.
        </p>
      </div>
    </>
  );
}

/* ─── Table ──────────────────────────────────────────────────── */

function TableAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // Keep the caret in the cell: a mousedown would blur the editor
      // first and every one of these commands acts on the selection.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
    >
      {children}
    </button>
  );
}

/**
 * The gear on a table's top-right corner, and the controls it opens.
 *
 * Rendered whenever the caret is inside a table, tracking that table's
 * own corner — so on a long table the controls are where the table is,
 * not at the top of the page. Replaces the second toolbar row, which
 * was permanently in view and nowhere near what it acted on.
 */
export function TableTools({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  // Bumped on every editor change so the rect is re-measured: adding a
  // row or a column resizes the table under the gear.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => {
      setTick((n) => n + 1);
      // Leaving the table closes the panel with it — otherwise it would
      // be waiting, still open, the next time the caret entered one.
      // Done here, in the editor's own callback, rather than in an
      // effect reacting to the measurement: that is a cascading render.
      if (!editor.isActive('table')) setOpen(false);
    };
    editor.on('selectionUpdate', bump);
    editor.on('transaction', bump);
    return () => {
      editor.off('selectionUpdate', bump);
      editor.off('transaction', bump);
    };
  }, [editor]);

  const rect = useTrackedRect(() => {
    if (!editor.isActive('table')) return null;
    let node: Node | null = null;
    try {
      node = editor.view.domAtPos(editor.state.selection.from).node;
    } catch {
      // A position mid-transaction can have no DOM yet; the next tick
      // measures again.
      return null;
    }
    const el =
      node instanceof HTMLElement ? node : (node?.parentElement ?? null);
    const table = el?.closest('table');
    if (!table) return null;
    const r = table.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  }, [editor, tick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!rect) return null;

  const chain = () => editor.chain().focus();
  const act = (run: () => void) => () => {
    run();
    setTick((n) => n + 1);
  };

  // Tucked just inside the table's top-right corner, so it overlaps the
  // table rather than pushing the page around.
  //
  // Clamped below the pinned title-and-toolbar band: scrolling down a
  // long table would otherwise carry the gear up under the band, where
  // it would either float on top of the toolbar or be lost behind it.
  // Held instead at the band's edge until the table's own bottom
  // arrives, so it stays with the table it belongs to. Measured rather
  // than assumed — the band grows with a two-line title. Read during
  // render, which is safe because scrolling re-measures the rect and
  // re-renders this anyway.
  const bandBottom =
    document.querySelector('[data-editor-band]')?.getBoundingClientRect()
      .bottom ?? 0;
  const gearTop = Math.min(
    Math.max(rect.top + 4, bandBottom + 6),
    rect.bottom - 32
  );
  const gearLeft = rect.right - 36;
  const panel = place(
    { top: gearTop, bottom: gearTop + 28, left: gearLeft - 240, right: gearLeft },
    280,
    92
  );

  return (
    <>
      <button
        type="button"
        title="Table options"
        aria-label="Table options"
        aria-expanded={open}
        aria-haspopup="menu"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        style={{ top: gearTop, left: gearLeft }}
        className={cn(
          'border-border bg-popover fixed z-50 flex size-7 cursor-pointer items-center justify-center rounded-md border shadow-sm transition-colors',
          open
            ? 'text-foreground bg-muted'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Settings2 className="size-4" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            aria-label="Table"
            style={{ top: panel.top, left: panel.left, width: 280 }}
            className={cn(PANEL, 'flex flex-wrap items-center gap-0.5 p-1.5')}
          >
            <TableAction
              label="Insert column before"
              onClick={act(() => chain().addColumnBefore().run())}
            >
              <ArrowLeftToLine className="size-4" />
            </TableAction>
            <TableAction
              label="Insert column after"
              onClick={act(() => chain().addColumnAfter().run())}
            >
              <ArrowRightToLine className="size-4" />
            </TableAction>
            <TableAction
              label="Delete column"
              onClick={act(() => chain().deleteColumn().run())}
            >
              <Columns3 className="size-4" />
            </TableAction>

            <span className="bg-border mx-1 h-5 w-px" />

            <TableAction
              label="Insert row above"
              onClick={act(() => chain().addRowBefore().run())}
            >
              <ArrowUpToLine className="size-4" />
            </TableAction>
            <TableAction
              label="Insert row below"
              onClick={act(() => chain().addRowAfter().run())}
            >
              <ArrowDownToLine className="size-4" />
            </TableAction>
            <TableAction
              label="Delete row"
              onClick={act(() => chain().deleteRow().run())}
            >
              <Rows3 className="size-4" />
            </TableAction>

            <span className="bg-border mx-1 h-5 w-px" />

            <TableAction
              label="Toggle header row"
              onClick={act(() => chain().toggleHeaderRow().run())}
            >
              <PanelTop className="size-4" />
            </TableAction>
            <TableAction
              label="Toggle header column"
              onClick={act(() => chain().toggleHeaderColumn().run())}
            >
              <PanelLeft className="size-4" />
            </TableAction>
            <TableAction
              label="Merge cells"
              onClick={act(() => chain().mergeCells().run())}
            >
              <Combine className="size-4" />
            </TableAction>
            <TableAction
              label="Split cell"
              onClick={act(() => chain().splitCell().run())}
            >
              <Split className="size-4" />
            </TableAction>

            <span className="bg-border mx-1 h-5 w-px" />

            <TableAction
              label="Delete table"
              onClick={() => {
                chain().deleteTable().run();
                setOpen(false);
              }}
            >
              <Trash2 className="size-4" />
            </TableAction>

            <p className="text-muted-foreground w-full px-1 pt-1 text-[11px]">
              Drag a column edge to resize
            </p>
          </div>
        </>
      )}
    </>
  );
}
