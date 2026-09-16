'use client';

import { useEffect, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { FaFacebookF, FaLinkedinIn, FaWhatsapp, FaXTwitter } from 'react-icons/fa6';

import { cn } from '@/lib/utils';

// ============================================================
// Share row for articles and the cards that link to them — bare icons,
// no pills or outlines: it sits beside the date or the Read more button
// rather than announcing itself.
//
// Client-only, because both jobs need the browser: the links are built
// from the live origin (the canonical host isn't known at build time),
// and the last icon copies the address to the clipboard.
// ============================================================

/** Used as the origin until the browser can supply the real one, so a
 *  card's share links are already valid in the served HTML. */
const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://instant.nebkern.com'
).replace(/\/$/, '');

export function ShareButtons({
  title,
  path,
  className,
}: {
  title: string;
  /**
   * The post's own path (`/blog/slug`), for a card that shares a post
   * other than the page it sits on. Omitted on an article page, which
   * shares wherever it is being read.
   */
  path?: string;
  className?: string;
}) {
  const [url, setUrl] = useState(path ? SITE + path : '');
  const [copied, setCopied] = useState(false);

  // Refine after mount to the origin actually being browsed, so a share
  // from a preview or a local run points at that copy. Setting state in
  // this effect is the intended pattern for a one-time read of a
  // browser-only value (doing it in render would cause a hydration
  // mismatch), so the set-state-in-effect rule is a false positive.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(path ? new URL(path, window.location.origin).href : window.location.href);
  }, [path]);

  // Clear the "copied" tick a moment later, and on unmount so the timer
  // cannot fire into a gone component.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (an insecure origin, or the
      // user's own permission settings). Nothing to recover — the four
      // share links still work, so fail quietly rather than alarm.
    }
  };

  const enc = encodeURIComponent;

  // WhatsApp and X take the title with the link; Facebook and LinkedIn
  // take the URL alone and pull the title from the page's own metadata.
  const targets = [
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${enc(`${title} ${url}`)}`,
      Icon: FaWhatsapp,
    },
    {
      label: 'X',
      href: `https://x.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`,
      Icon: FaXTwitter,
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      Icon: FaFacebookF,
    },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
      Icon: FaLinkedinIn,
    },
  ];

  const item =
    'text-(--lp2-ink-soft) transition-colors hover:text-(--lp2-ink) focus-visible:text-(--lp2-ink)';

  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      {targets.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share "${title}" on ${label}`}
          className={item}
        >
          <Icon className="size-4.25" />
        </a>
      ))}

      <button
        type="button"
        onClick={copyLink}
        aria-label={`Copy link to "${title}"`}
        className={cn(item, 'cursor-pointer')}
      >
        {copied ? (
          <Check className="size-4.25 text-(--lp2-grass)" strokeWidth={3} />
        ) : (
          <Link2 className="size-4.25" strokeWidth={2.5} />
        )}
      </button>

      {/* Announced to a screen reader, since the tick alone is silent. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Link copied' : ''}
      </span>
    </div>
  );
}
