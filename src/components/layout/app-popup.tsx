'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  isExternalLink,
  youtubeEmbedUrl,
  type AppPopup as Popup,
} from '@/lib/app-popup';

const DISMISS_PREFIX = 'wacrm:popup-dismissed:';

function isDismissed(id: string): boolean {
  try {
    return localStorage.getItem(DISMISS_PREFIX + id) === '1';
  } catch {
    return false;
  }
}

function markDismissed(id: string) {
  try {
    localStorage.setItem(DISMISS_PREFIX + id, '1');
  } catch {
    // Storage unavailable (private mode) — it'll just show again next load.
  }
}

/**
 * Splash popup shown once per account when the app loads. Fetches the
 * newest live popup; renders whatever content it carries (text, image,
 * YouTube video, link CTA — in any combination). Dismissal is remembered
 * per-popup in localStorage so it doesn't nag on every load.
 */
export function AppPopup() {
  const router = useRouter();
  const [popup, setPopup] = useState<Popup | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/popup')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const p: Popup | null = data?.popup ?? null;
        if (cancelled || !p || isDismissed(p.id)) return;
        setPopup(p);
        setOpen(true);
      })
      .catch(() => {
        /* no popup on failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!popup) return null;

  const embed = youtubeEmbedUrl(popup.youtubeUrl);

  const dismiss = () => {
    markDismissed(popup.id);
    setOpen(false);
  };

  const onCta = () => {
    if (!popup.linkUrl) return;
    markDismissed(popup.id);
    setOpen(false);
    if (isExternalLink(popup.linkUrl)) {
      window.open(popup.linkUrl, '_blank', 'noopener,noreferrer');
    } else {
      router.push(popup.linkUrl);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-lg">
        {embed && (
          <div className="aspect-video w-full overflow-hidden rounded-t-xl bg-black">
            <iframe
              src={embed}
              title={popup.title ?? 'Video'}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {!embed && popup.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={popup.imageUrl}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            className="max-h-72 w-full rounded-t-xl object-cover"
          />
        )}

        <div className="space-y-4 p-6">
          {(popup.title || (!embed && !popup.imageUrl)) && (
            <DialogHeader>
              <DialogTitle>{popup.title ?? 'Announcement'}</DialogTitle>
            </DialogHeader>
          )}

          {/* When there's media AND a title, the title sits above; when
              media-only with a title, still show it. */}
          {embed && popup.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={popup.imageUrl}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              className="max-h-60 w-full rounded-lg object-cover"
            />
          )}

          {popup.body && (
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {popup.body}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={dismiss}>
              Dismiss
            </Button>
            {popup.linkUrl && (
              <Button
                type="button"
                onClick={onCta}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {popup.linkLabel?.trim() || 'Learn more'}
                <ArrowUpRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
