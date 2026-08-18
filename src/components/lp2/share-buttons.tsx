'use client';

import { useEffect, useState } from 'react';
import { FaFacebookF, FaWhatsapp } from 'react-icons/fa6';

import { cn } from '@/lib/utils';

// ============================================================
// Share row for /lp-2 article pages. Client-only: it reads the live
// page URL from the browser, so the links point at wherever the post is
// actually being viewed rather than a build-time guess.
// ============================================================

export function ShareButtons({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const [url, setUrl] = useState('');

  // Resolve after mount — window isn't available while rendering on the
  // server, and the canonical host isn't known at build time. Setting
  // state in this effect is the intended pattern for a one-time read of
  // a browser-only value (doing it in render would cause a hydration
  // mismatch), so the set-state-in-effect rule is a false positive here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(window.location.href);
  }, []);

  const enc = encodeURIComponent;
  const waHref = `https://wa.me/?text=${enc(`${title} ${url}`)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;

  const btn =
    'flex size-9 items-center justify-center rounded-full border-2 border-(--lp2-ink) text-white transition-transform duration-150 hover:-translate-y-0.5';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-base font-bold text-(--lp2-ink-soft)">Share</span>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on WhatsApp"
        className={cn(btn, 'bg-(--lp2-grass)')}
      >
        <FaWhatsapp className="size-4" />
      </a>
      <a
        href={fbHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Facebook"
        className={cn(btn, 'bg-(--lp2-sky)')}
      >
        <FaFacebookF className="size-3.5" />
      </a>
    </div>
  );
}
