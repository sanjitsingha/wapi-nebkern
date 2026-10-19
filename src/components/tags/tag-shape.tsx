import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A tag drawn as a price tag — a pointed left end with a punched hole,
 * in a soft wash of the tag's colour. The one way a tag looks across the
 * app: Settings → Tags, the inbox panel and its tag picker.
 *
 * The fill is the colour mixed into the card background rather than
 * the colour at low alpha, so the point and the body (two overlapping
 * shapes) read as one solid piece.
 *
 * `sm` is the panel's size. `onRemove` adds a × after the name.
 */
export function TagShape({
  name,
  color,
  size = 'md',
  onRemove,
  removeDisabled,
}: {
  name: string;
  color: string;
  size?: 'sm' | 'md';
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  const fill = `color-mix(in srgb, ${color} 16%, var(--card))`;
  const sm = size === 'sm';
  return (
    <span className={cn('relative inline-flex max-w-full items-center', sm ? 'h-6 pl-[12px]' : 'h-7 pl-[14px]')}>
      {/* The point: a square turned 45°, its tip at the left edge. */}
      <span
        aria-hidden
        className={cn(
          'absolute top-1/2 -translate-y-1/2 rotate-45 rounded-[3px]',
          sm ? 'left-[3.5px] size-[17px]' : 'left-[4px] size-[20px]',
        )}
        style={{ backgroundColor: fill }}
      />
      <span
        className={cn(
          'relative inline-flex h-full min-w-0 items-center gap-1 rounded-r-md font-medium',
          sm ? 'pr-2 pl-1.5 text-xs' : 'pr-3 pl-2 text-sm',
        )}
        style={{ backgroundColor: fill, color }}
      >
        <span className="truncate">{name}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={removeDisabled}
            aria-label={`Remove ${name}`}
            className="-mr-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full opacity-60 transition-opacity hover:bg-black/10 hover:opacity-100 disabled:opacity-40"
          >
            <X className="size-2.5" />
          </button>
        )}
      </span>
      {/* The hole. */}
      <span
        aria-hidden
        className={cn(
          'bg-card absolute top-1/2 -translate-y-1/2 rounded-full',
          sm ? 'left-[7.5px] size-[5px]' : 'left-[9px] size-1.5',
        )}
      />
    </span>
  );
}
