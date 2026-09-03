'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * A compact pager for the list tables. Rows are filtered client-side and
 * then sliced to one page before rendering, so a list of a few thousand
 * never puts more than `pageSize` rows in the DOM at once.
 *
 * Renders nothing when everything fits on one page — small lists show no
 * chrome, large ones get Prev / Page X of Y / Next.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  /** 1-based current page. */
  page: number;
  pageSize: number;
  /** Total rows across all pages (the filtered count, not just this page). */
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-xs tabular-nums text-muted-foreground">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <span className="px-1 text-xs tabular-nums text-muted-foreground">
          Page {page} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Clamp a 1-based page to the available range for `total` rows. */
export function clampPage(page: number, pageSize: number, total: number): number {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(1, page), pageCount);
}
