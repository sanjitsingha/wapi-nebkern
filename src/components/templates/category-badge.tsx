import {
  Megaphone,
  Wrench,
  ShieldCheck,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { softBadge } from '@/lib/badge-colors';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============================================================
// Meta template category badges — shared by the campaigns and templates
// pages so a category reads identically (same hue, same icon) in the
// filter dropdown and the table on both.
// ============================================================

export type TemplateCategory = 'Marketing' | 'Utility' | 'Authentication';

/**
 * One visual identity per Meta template category — a distinct hue and a
 * meaning-carrying icon (not the generic tag, which implied a free-form
 * label rather than one of Meta's three fixed categories).
 */
export const TEMPLATE_CATEGORY_STYLES: Record<
  TemplateCategory,
  { badge: string; icon: LucideIcon; iconColor: string }
> = {
  Marketing: {
    badge: softBadge.blue,
    icon: Megaphone,
    iconColor: 'text-blue-600 dark:text-blue-300',
  },
  Utility: {
    badge: softBadge.amber,
    icon: Wrench,
    iconColor: 'text-amber-600 dark:text-amber-300',
  },
  Authentication: {
    badge: softBadge.purple,
    icon: ShieldCheck,
    iconColor: 'text-purple-600 dark:text-purple-300',
  },
};

/** Colour-coded category pill. Falls back to a neutral "Unknown" chip
 *  when the category is missing or isn't one of the three, so the cell
 *  never renders empty. */
export function CategoryChip({ category }: { category?: string | null }) {
  const style = category
    ? TEMPLATE_CATEGORY_STYLES[category as TemplateCategory]
    : undefined;

  if (!style) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
          softBadge.neutral,
        )}
      >
        {category ?? 'Unknown'}
      </span>
    );
  }

  const Icon = style.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        style.badge,
      )}
    >
      <Icon className="h-3 w-3" />
      {category}
    </span>
  );
}

/**
 * Category cell. Normally just the colour-coded chip — but when Meta
 * reclassified the template on review (its current `category` differs
 * from the `originalCategory` the user submitted), it shows the original
 * struck-through, an arrow, then Meta's new category, and explains the
 * swap on hover.
 */
export function CategoryCell({
  category,
  originalCategory,
}: {
  category?: string | null;
  originalCategory?: string | null;
}) {
  const reclassified =
    !!category && !!originalCategory && category !== originalCategory;

  if (!reclassified) {
    return <CategoryChip category={category} />;
  }

  const originalStyle =
    TEMPLATE_CATEGORY_STYLES[originalCategory as TemplateCategory] ?? undefined;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex cursor-help items-center gap-1.5">
            <span
              className={cn(
                'text-xs line-through decoration-1',
                originalStyle?.iconColor ?? 'text-muted-foreground',
              )}
            >
              {originalCategory}
            </span>
            <ArrowRight className="text-muted-foreground h-3 w-3 shrink-0" />
            <CategoryChip category={category} />
          </span>
        }
      />
      <TooltipContent>
        Meta reclassified this template from {originalCategory} to {category}.
      </TooltipContent>
    </Tooltip>
  );
}
