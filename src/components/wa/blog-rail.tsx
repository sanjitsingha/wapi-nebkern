import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Magnetic } from '@/components/ui/magnetic-button';
import { hardShadowButton } from '@/components/lp2/ui';
import { cn } from '@/lib/utils';
import { WaRail } from './rail';
import { waType } from './ui';

// ============================================================
// "From the blog" — recent posts as a horizontal rail, the way
// whatsapp.com and instagram.com surface their newest articles on the
// landing page.
//
// Text only, on purpose: a date, the title, a short description and a
// Read more button. The features rail higher up is picture-led; a second
// row of pictures would compete, and a post's cover is rarely made for a
// card this small.
//
// Each card is an <article>, not one big link: the Read more button is a
// link of its own, and a link cannot sit inside another. The title links
// to the same post, so clicking the headline still works.
//
// HOVER
//
// Hovering the card (or focusing either link) draws a green underline
// along the title. It is a background image rather than
// `text-decoration`, which cannot animate its length. On a wrapped title
// the browser's default `box-decoration-break: slice` treats every line
// as one continuous strip, so as the background grows from 0% to 100%
// it runs along the first line, then carries on into the next — one line
// after another, in reading order.
// ============================================================

export interface WaBlogCardItem {
  slug: string;
  title: string;
  excerpt: string | null;
  /** Empty for sample cards — they have no publish date. */
  dateLabel: string;
  /** Development-only filler — see SAMPLE_BLOG_CARDS. */
  sample?: boolean;
}

/**
 * Placeholder cards for previewing the rail's layout while only a
 * handful of posts are published. The landing page adds these in
 * development only — a production visitor never sees an article that
 * does not exist. They link to the blog index rather than a real post.
 */
export const SAMPLE_BLOG_CARDS: WaBlogCardItem[] = [
  { slug: '', sample: true, dateLabel: '', title: 'How to get your WhatsApp Business API approved in a week', excerpt: 'The documents Meta asks for, the display-name rules that trip people up, and what to do when verification stalls.' },
  { slug: '', sample: true, dateLabel: '', title: 'Broadcasts that get replies, not blocks', excerpt: 'Templates, timing and opt-outs: the habits that keep your quality rating high while a campaign reaches thousands.' },
  { slug: '', sample: true, dateLabel: '', title: 'Letting an AI agent answer customers without losing the human touch', excerpt: 'Where an agent should stop and hand over, and how to write the knowledge base it learns from.' },
  { slug: '', sample: true, dateLabel: '', title: 'Shared inbox etiquette for teams of five to fifty', excerpt: 'Assignment rules, internal notes and the 24-hour window — so two people never answer the same customer.' },
];

/* Width per card, so about 3.5 show at once on a laptop:
     phone ~1.2   tablet ~2.5   laptop+ ~3.5
   Same arithmetic as the features rail: visible rail = viewport minus
   the left gutter — 24px below xl, (100vw + 1232px) / 2 from xl — less
   one 16px gap per whole card. */
const CARD = cn(
  // `relative` is load-bearing. The Read more link carries an `sr-only`
  // label, which is absolutely positioned. Without a positioned ancestor
  // inside the rail it would be placed against the page itself — so the
  // labels on cards scrolled off to the right escaped the rail's
  // overflow clipping and stretched the whole page sideways.
  'group relative flex min-h-[320px] shrink-0 snap-start flex-col rounded-[25px] p-7 lg:p-8',
  'w-[82%]',
  'sm:w-[calc((100vw-56px)/2.5)]',
  'lg:w-[calc((100vw-72px)/3.5)]',
  'xl:w-[calc(((100vw+1232px)/2-48px)/3.5)]',
);

const TITLE = 'text-[22px] leading-[29px] text-balance text-(--wa-ink) lg:text-[24px] lg:leading-[31px]';

/* The growing green underline: 0% wide at rest, 100% while the card is
   hovered or one of its links has keyboard focus. Deliberately no
   `box-decoration-break: clone` — see HOVER above. */
const TITLE_UNDERLINE =
  'bg-[linear-gradient(var(--wa-green),var(--wa-green))] bg-[length:0%_2px] bg-left-bottom bg-no-repeat pb-1 transition-[background-size] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-[length:100%_2px] group-focus-within:bg-[length:100%_2px] motion-reduce:transition-none';

export function WaBlogRail({ posts }: { posts: WaBlogCardItem[] }) {
  return (
    <WaRail
      label="Recent articles"
      title="From the blog"
      subtitle="Playbooks, product news and what we learn running WhatsApp for teams that sell on it."
    >
      {posts.map((p) => {
        const href = p.sample ? '/blog' : `/blog/${p.slug}`;
        return (
          <article key={p.sample ? p.title : p.slug} data-card className={cn(CARD, 'bg-white')}>
            {p.dateLabel && (
              <span className={cn(waType.caption, 'mb-4 tracking-wide text-(--wa-ink-muted) uppercase')}>
                {p.dateLabel}
              </span>
            )}
            <h3 className={TITLE}>
              <Link href={href} className="outline-none">
                <span className={TITLE_UNDERLINE}>{p.title}</span>
              </Link>
            </h3>
            {p.excerpt && (
              <p className={cn(waType.bodyMd, 'mt-3 line-clamp-3 text-pretty text-(--wa-ink-muted)')}>
                {p.excerpt}
              </p>
            )}
            {/* mt-auto pins the button to the card's foot, so buttons line
                up across the row whatever the length of the copy above. */}
            <div className="mt-auto pt-6">
              <Magnetic>
                <Link href={href} className={hardShadowButton}>
                  Read more
                  <span className="sr-only">: {p.title}</span>
                  <ArrowRight className="size-4" strokeWidth={2.5} />
                </Link>
              </Magnetic>
            </div>
          </article>
        );
      })}

      {/* The last card is the way into the rest of the blog. */}
      <article data-card className={cn(CARD, 'bg-(--wa-tint)')}>
        <h3 className={TITLE}>
          <Link href="/blog" className="outline-none">
            <span className={TITLE_UNDERLINE}>See every article</span>
          </Link>
        </h3>
        <div className="mt-auto pt-6">
          <Magnetic>
            <Link href="/blog" className={hardShadowButton}>
              View all
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </Link>
          </Magnetic>
        </div>
      </article>
    </WaRail>
  );
}
