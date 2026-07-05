'use client';

import { useEffect, useState } from 'react';
import type { Message } from '@/types';
import {
  FileText,
  Music,
  Play,
  ImageOff,
  Loader2,
  Link as LinkIcon,
  ExternalLink,
  ImageIcon,
} from 'lucide-react';

/* ─── Link extraction ─────────────────────────────────────────────── */

const URL_RE = /\bhttps?:\/\/[^\s<>()]+/gi;

export interface LinkItem {
  id: string;
  url: string;
  /** The full message text the link came from (for context). */
  text: string;
  created_at: string;
}

/** Pull every http(s) URL out of a contact's text messages, newest first. */
export function extractLinks(messages: Message[]): LinkItem[] {
  const links: LinkItem[] = [];
  for (const m of messages) {
    if (!m.content_text) continue;
    const matches = m.content_text.match(URL_RE);
    if (!matches) continue;
    matches.forEach((url, i) => {
      links.push({
        id: `${m.id}-${i}`,
        // Trim trailing punctuation that commonly clings to pasted links.
        url: url.replace(/[.,;:!?)\]]+$/, ''),
        text: m.content_text!,
        created_at: m.created_at,
      });
    });
  }
  return links;
}

/** Media messages (image/video/audio/document with a media_url), newest first. */
export function filterMedia(messages: Message[]): Message[] {
  return messages.filter(
    (m) =>
      ['image', 'video', 'audio', 'document'].includes(m.content_type) &&
      !!m.media_url,
  );
}

/* ─── Shared bits ─────────────────────────────────────────────────── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function EmptyState({ icon: Icon, text }: { icon: typeof ImageIcon; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

/* ─── Media thumbnail ─────────────────────────────────────────────── */

// Image/video thumbnail. Proxy URLs (/api/whatsapp/media/…) are fetched
// as a blob for inline display (mirrors the inbox bubble); the link
// itself always points at the original URL so opening in a new tab
// re-fetches with the session cookie.
function MediaThumb({ message }: { message: Message }) {
  const url = message.media_url as string;
  const isVideo = message.content_type === 'video';
  const [src, setSrc] = useState<string | null>(
    url.startsWith('/api/whatsapp/media/') ? null : url,
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url.startsWith('/api/whatsapp/media/')) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('media');
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
    >
      {error ? (
        <span className="flex h-full w-full items-center justify-center">
          <ImageOff className="size-6 text-muted-foreground" />
        </span>
      ) : !src ? (
        <span className="flex h-full w-full items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </span>
      ) : isVideo ? (
        <>
          <video src={src} muted className="h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="flex size-9 items-center justify-center rounded-full bg-black/55">
              <Play className="size-4 fill-white text-white" />
            </span>
          </span>
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Shared media"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          onError={() => setError(true)}
        />
      )}
    </a>
  );
}

function FileRow({ message }: { message: Message }) {
  const isAudio = message.content_type === 'audio';
  const Icon = isAudio ? Music : FileText;
  return (
    <a
      href={message.media_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {message.content_text || (isAudio ? 'Audio message' : 'Document')}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(message.created_at)}
        </span>
      </span>
      <ExternalLink className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}

/* ─── Media tab ───────────────────────────────────────────────────── */

export function ContactMedia({
  items,
  loading,
}: {
  items: Message[];
  loading: boolean;
}) {
  if (loading) return <Spinner />;
  if (items.length === 0) {
    return <EmptyState icon={ImageIcon} text="No media shared with this contact yet." />;
  }

  const visual = items.filter(
    (m) => m.content_type === 'image' || m.content_type === 'video',
  );
  const files = items.filter(
    (m) => m.content_type === 'document' || m.content_type === 'audio',
  );

  return (
    <div className="space-y-8">
      {visual.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Photos &amp; videos
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {visual.map((m) => (
              <MediaThumb key={m.id} message={m} />
            ))}
          </div>
        </section>
      )}

      {files.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Files
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {files.map((m) => (
              <FileRow key={m.id} message={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── Links tab ───────────────────────────────────────────────────── */

export function ContactLinks({
  items,
  loading,
}: {
  items: LinkItem[];
  loading: boolean;
}) {
  if (loading) return <Spinner />;
  if (items.length === 0) {
    return <EmptyState icon={LinkIcon} text="No links shared with this contact yet." />;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((link) => {
        let host = link.url;
        try {
          host = new URL(link.url).hostname.replace(/^www\./, '');
        } catch {
          /* keep the raw url as the label */
        }
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <LinkIcon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {host}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {link.url}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <ExternalLink className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              <span className="text-[10px] text-muted-foreground">
                {formatDate(link.created_at)}
              </span>
            </span>
          </a>
        );
      })}
    </div>
  );
}
