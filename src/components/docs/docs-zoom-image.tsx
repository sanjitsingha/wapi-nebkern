'use client';

import Image from 'next/image';
import { Dialog } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { DocsImage } from '@/components/docs/docs-components';

// The sign-in and app pages' background, which most shots are cut from:
// padding a shot out to 5:3 in its own colour doesn't show.
const FRAME_BG = '#f9fafc';

// A small, exact radius. The site's WhatsApp theme rounds every
// `rounded-*` class to 25px; a bracketed value is left alone.
const RADIUS = 'rounded-[6px]';

/**
 * A docs screenshot in a 5:3 frame, so every picture on a page is the
 * same shape whatever the crop: the shot sits inside at its own ratio,
 * on its own background colour. A click opens it full size over a
 * dimmed page; a click anywhere, or Esc, closes it again.
 */
export function DocsZoomImage({ image }: { image: DocsImage }) {
  const ratio = image.width / image.height;

  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={cn(
          'block aspect-5/3 w-full cursor-zoom-in overflow-hidden border border-(--lp2-ink)/10 shadow-sm',
          RADIUS,
        )}
        style={{ background: image.background ?? FRAME_BG }}
      >
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes="(min-width: 1024px) 768px, 100vw"
          className="size-full object-contain"
        />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup
          className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          // As big as the window allows, but no more than twice the
          // file's size, past which a small crop just turns to mush.
          style={{ width: `min(92vw, ${(88 * ratio).toFixed(2)}vh, ${image.width * 2}px)` }}
        >
          <Dialog.Title className="sr-only">{image.caption ?? image.alt}</Dialog.Title>
          <Dialog.Close aria-label="Close" className="block w-full cursor-zoom-out">
            <Image
              src={image.src}
              alt=""
              width={image.width}
              height={image.height}
              sizes="92vw"
              className={cn('h-auto w-full', RADIUS)}
            />
          </Dialog.Close>
        </Dialog.Popup>
        <Dialog.Close
          aria-label="Close"
          className="fixed top-4 right-4 z-50 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <XIcon className="size-5" />
        </Dialog.Close>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
