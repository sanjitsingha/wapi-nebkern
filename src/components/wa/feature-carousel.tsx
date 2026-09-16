import Image from 'next/image';
import {
  Bot,
  Megaphone,
  MessagesSquare,
  Plug,
  QrCode,
  SquareKanban,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { WaRail } from './rail';
import { WaPill, waType } from './ui';

// ============================================================
// "Everything your team needs to turn chats into customers" — a
// horizontal card rail.
//
// whatsapp.com lays feature stories out as a row of tall tiles you
// scroll sideways, rather than a grid you scroll past. Each tile here is
// the spec's 25px white tile, picture-led: most of its height is the
// picture, with a short title and line of copy underneath. The detail
// lives on each feature's own page, so the card's job is to be seen.
//
// The heading, arrows and scrolling come from WaRail (rail.tsx); this
// file is only the cards.
//
// IMAGES
//
// None exist yet, so every card renders a placeholder — a tinted panel
// with the feature's icon. Give a card an `image` (a path under /public
// or an allowed remote URL) and the placeholder is replaced by that
// picture, cropped to fill the band.
// ============================================================

interface Feature {
  term: string;
  body: string;
  icon: LucideIcon;
  /** Path or allowed remote URL. Omitted → placeholder panel. */
  image?: string;
  /**
   * The feature's own page. Only set where one exists — the card then
   * carries a Read more. The rest stop at the paragraph rather than
   * sending someone to a page that does not answer the card.
   */
  href?: string;
}

const FEATURES: Feature[] = [
  { term: 'Shared team inbox', icon: MessagesSquare, href: '/features/shared-inbox', image: '/images/features/shared-team-inbox.webp', body: 'WhatsApp, Instagram and Messenger in one thread list. Assign an owner, leave notes your customer never sees, and keep the history with the contact rather than the agent.' },
  { term: 'Broadcast campaigns', icon: Megaphone, href: '/features/campaigns', body: 'Send an approved template to thousands, filtered by tag, pipeline stage or last activity. Delivery, read and reply rates arrive live rather than in a report next week.' },
  { term: 'Pipelines & CRM', icon: SquareKanban, href: '/features/pipelines', body: 'Custom fields, tags and drag-and-drop stages wrapped around the conversation itself, so a chat becomes a deal without anyone retyping it into another system.' },
  { term: 'Flows & automations', icon: Workflow, body: 'No-code triggers, conditions, waits and actions. Greet, qualify, route and follow up at 3am, then hand to a human the moment it stops being routine.' },
  { term: 'AI agents', icon: Bot, body: 'Answer in seconds from your own documents and past replies, in your own tone. Every answer is logged, and anything the agent is unsure of goes to a person instead of being guessed at.' },
  { term: 'Widget, QR & links', icon: QrCode, body: 'Turn a website visitor, a poster or a printed menu into a WhatsApp conversation in one tap. Every entry point is tracked, so you can see which ones actually bring people in.' },
  { term: 'Easy integrations', icon: Plug, body: 'Push every message, contact and deal event into your own stack, or drive Instant from it. Your data stays yours, and stays reachable.' },
];

export function WaFeatureCarousel() {
  return (
    <WaRail
      id="features"
      label="Features"
      // A white band between the cream sections around it. bg-(--wa-white)
      // rather than bg-white: whatsapp.css repaints `section.bg-white` cream.
      className="bg-(--wa-white)"
      title={
        <>
          Everything your team needs
          {/* Two lines from sm up; on a phone the words wrap as they fit. */}
          <br className="hidden sm:block" /> to turn chats into customers
        </>
      }
      subtitle="Manage conversations, qualify leads, automate follow-ups, and track every opportunity without jumping between tools."
    >
      {FEATURES.map((f) => (
        <article
          key={f.term}
          data-card
          className={cn(
            // White cards on the section's white band. With no fill to
            // separate them they take the spec's hairline, the same way
            // whatsapp.css keeps a white pill visible on a white card —
            // the picture band below carries the rest of the contrast.
            'flex shrink-0 snap-start flex-col overflow-hidden rounded-[25px] border border-(--wa-hairline) bg-(--wa-white)',
            // Sized so a set number of cards shows at once, the last one
            // cut by the screen edge so the row reads as scrollable:
            //   phone ~1.2   tablet ~1.5   laptop+ ~2.5
            // Visible rail = viewport minus the left gutter. Below xl the
            // gutter is the 24px padding; from xl (1280) it is half of the
            // viewport beyond 1232px, so the visible width is
            // (100vw + 1232px) / 2. Each count subtracts its gaps (16px).
            // No fixed height: the picture band has a set height and the
            // text sizes itself, so copy never overflows. Cards in the row
            // still match — flex rows stretch every card to the tallest.
            'w-[82%]',
            'sm:w-[calc((100vw-40px)/1.5)]',
            'lg:w-[calc((100vw-56px)/2.5)]',
            'xl:w-[calc(((100vw+1232px)/2-32px)/2.5)]',
          )}
        >
          {/* The picture band — the larger part of the card. Heights are
              picked to stay taller than the text below at every width:
              the text runs ~230px on a phone and ~250px on a laptop. */}
          <div className="relative h-[260px] shrink-0 bg-(--wa-tint) sm:h-[300px] lg:h-[320px] xl:h-[360px]">
            {f.image ? (
              <Image
                src={f.image}
                alt=""
                fill
                sizes="(min-width: 1024px) 40vw, (min-width: 640px) 66vw, 82vw"
                className="object-cover"
              />
            ) : (
              <div aria-hidden className="flex h-full items-center justify-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-white">
                  <f.icon className="size-7 text-(--wa-ink)" strokeWidth={1.75} />
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col p-7 lg:p-9">
            <h3 className="text-[24px] leading-[28px] text-(--wa-ink) lg:text-[30px] lg:leading-[34px]">
              {f.term}
            </h3>
            <p className={cn(waType.bodyMd, 'mt-3 text-pretty text-(--wa-ink-muted) lg:mt-4 lg:text-[18px] lg:leading-[26px]')}>
              {f.body}
            </p>
            {f.href && (
              // `mt-auto` rather than a fixed margin: cards stretch to the
              // tallest in the row, so this keeps every button on the same
              // line however long the copy above it runs.
              <div className="mt-auto pt-6">
                <WaPill href={f.href}>
                  Read more
                  {/* "Read more" on its own is the same link seven times to
                      anyone reading the page by its links alone. */}
                  <span className="sr-only"> about {f.term}</span>
                </WaPill>
              </div>
            )}
          </div>
        </article>
      ))}
    </WaRail>
  );
}
