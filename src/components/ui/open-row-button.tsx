'use client';

import { ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The arrow that appears on a table row's name cell on hover, opening
 * that record.
 *
 * Was copy-pasted into five table views — campaigns, automations,
 * flows, forms and templates — with the same twelve utility classes
 * each time, differing only in whether the click stopped propagating.
 * They had already begun to drift, which is what a shared component
 * here prevents.
 *
 * Green fill rather than the previous outline: at 7px, hidden until
 * hover, an outlined chip reads as a border artefact rather than
 * something to press. A filled accent chip is unmistakably a control,
 * and `cursor-pointer` says so before it is clicked — the surrounding
 * row is often clickable too, so the arrow has to look like the more
 * specific target rather than part of the row.
 */
export function OpenRowButton({
  label,
  onClick,
  /**
   * Stop the click reaching the row underneath. Needed wherever the row
   * itself navigates — without it a click here fires both handlers and
   * the arrow's own destination loses the race.
   */
  stopPropagation = true,
  className,
}: {
  label: string;
  onClick: () => void;
  stopPropagation?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onClick();
      }}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md',
        'bg-primary text-primary-foreground shadow-sm',
        'transition-all hover:bg-primary/90 hover:shadow',
        // Hidden until the cell is hovered, but ALWAYS reachable by
        // keyboard: `focus-visible:opacity-100` is what stops this
        // being a mouse-only control.
        'opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100',
        'focus-visible:ring-primary/40 focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      <ArrowUpRight className="h-4 w-4" />
    </button>
  );
}
