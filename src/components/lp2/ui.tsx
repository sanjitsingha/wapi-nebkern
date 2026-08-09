import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Highlight, type Lp2Hue } from './decor';

// ============================================================
// /lp-2 shared UI — the button and the section heading.
//
// Every section on this page repeats the same two moves, and they are
// exactly the pieces that go wrong when copy-pasted: a button whose
// press animation drifts out of sync with its neighbours, or a heading
// that quietly changes size halfway down the page. One definition each.
// ============================================================

/**
 * The tactile press. The sticker shadow shrinks while the element
 * slides into the space it vacated, so it reads as being physically
 * pushed down rather than merely tinted.
 *
 * Exported as a string (not baked into a component) because the nav
 * pill, the hero CTAs and the FAQ rows all want the behaviour on
 * wildly different shapes.
 */
export const press =
  'transition-all duration-150 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--lp2-ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none';

export function Btn({
  href,
  children,
  variant = 'primary',
  className,
}: {
  href: string;
  children: React.ReactNode;
  /** `primary` = solid green, `plain` = white. Both carry the ink
   *  outline and the offset shadow — that pairing is the page's
   *  handwriting, and a button without it stops looking native here. */
  variant?: 'primary' | 'plain';
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-(--lp2-ink) px-7 text-base font-bold shadow-(--lp2-shadow)',
        variant === 'primary' ? 'bg-(--lp2-grass) text-white' : 'bg-white',
        press,
        className
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Section heading: a display-face title and one line of support.
 *
 * There used to be a coloured eyebrow chip above the title on every
 * section — "The platform", "Pricing", "Questions". Eleven of them down
 * one page turned into wallpaper: the reader learns to skip the chip to
 * get to the heading, and each one pushed the actual title 50px further
 * from the section above it. The titles say the same thing and say it
 * better.
 *
 * `hue` stays because it still colours the highlight box.
 *
 * `highlight` marks a word inside `title` to box — passed as its own
 * prop rather than as JSX so a section can't accidentally ship two
 * highlight boxes in one heading, which turns the page's loudest device
 * into noise.
 */
export function SectionHead({
  hue = 'lemon',
  title,
  highlight,
  highlightText = 'ink',
  subtitle,
  className,
}: {
  hue?: Lp2Hue;
  /**
   * Ink on the highlight box by default. `white` is opt-in per call
   * rather than derived from the hue, because it is only legible on the
   * deeper ones (sky, grape, coral, grass) and only at display size —
   * these headings run 44px, where the 3:1 large-text bar applies. On
   * `lemon` or `mint` it would be unreadable, so nothing picks it
   * automatically.
   */
  highlightText?: 'ink' | 'white';
  title: string;
  /** Substring of `title` to wrap in the highlight box. Must appear in
   *  `title` verbatim or it's ignored. */
  highlight?: string;
  subtitle?: string;
  className?: string;
}) {
  const [before, after] =
    highlight && title.includes(highlight)
      ? [
          title.slice(0, title.indexOf(highlight)),
          title.slice(title.indexOf(highlight) + highlight.length),
        ]
      : [title, null];

  return (
    <div className={cn('mx-auto max-w-2xl text-center', className)}>
      <h2 className="lp2-display text-3xl leading-[1.08] font-extrabold text-balance sm:text-[2.75rem]">
        {before}
        {after !== null && (
          <>
            {/* The box overshoots the word it frames by 0.12em a side,
                which eats the space character next to it — mid-sentence
                highlights end up welded to the following word. Same
                fix compare.tsx makes inline for the same reason. */}
            <Highlight
              color={hue}
              className={cn(
                'mx-[0.1em]',
                highlightText === 'white' && 'text-white'
              )}
            >
              {highlight}
            </Highlight>
            {after}
          </>
        )}
      </h2>

      {subtitle && (
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-pretty text-(--lp2-ink-soft) sm:text-lg">
          {subtitle}
        </p>
      )}
    </div>
  );
}
