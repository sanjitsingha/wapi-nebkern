'use client';

import Link from 'next/link';
import { ArrowUpRight, Info } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * The small "i" next to a page or section title: a sentence explaining
 * what this thing is, plus a link into the docs for the full story.
 *
 * Built on Popover rather than Tooltip on purpose. A tooltip is not
 * allowed to contain anything interactive — you can't move the pointer
 * into one without it closing, and screen readers don't expose links
 * inside it — so a "Learn more" link needs a popup that can be entered,
 * focused and tabbed through. `openOnHover` on the trigger gets the
 * tooltip *feel* back: it opens on hover, and still opens on click or
 * Enter, which is the only way this works on a touch screen.
 *
 * The docs link opens in a new tab deliberately: someone reading a hint
 * mid-task (a half-built campaign, a filtered inbox) should not lose
 * that state to a navigation.
 */
export function InfoHint({
  label,
  children,
  docs,
  side = 'bottom',
  align = 'start',
  className,
}: {
  /** Bolded heading inside the popup — usually the thing being
   *  explained ("Campaigns"). Also names the trigger for screen
   *  readers. */
  label: string;
  /** One or two sentences. Plain language, no feature-listing. */
  children: React.ReactNode;
  /** Docs path, e.g. `/docs/campaigns`. Omit for a hint with no
   *  matching docs page — the link is simply left off. */
  docs?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        // A beat of grace on the way out, so the pointer can travel from
        // the icon into the popup to reach the link without it closing.
        closeDelay={150}
        aria-label={`About ${label}`}
        className={cn(
          'text-muted-foreground/70 hover:text-foreground data-popup-open:text-foreground focus-visible:ring-ring inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none',
          className,
        )}
      >
        <Info className="size-4" />
      </PopoverTrigger>

      <PopoverContent side={side} align={align} className="w-72 gap-2 p-3">
        <p className="text-foreground text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          {children}
        </p>
        {docs && (
          <Link
            href={docs}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex items-center gap-1 text-[13px] font-medium hover:underline"
          >
            Learn more
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </PopoverContent>
    </Popover>
  );
}
