// ============================================================
// App splash popup — shared types + helpers (migration 059).
// ============================================================

export interface AppPopup {
  id: string;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  youtubeUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
}

export interface AppPopupRow {
  id: string;
  title: string | null;
  body: string | null;
  image_url: string | null;
  youtube_url: string | null;
  link_url: string | null;
  link_label: string | null;
}

export function mapPopupRow(r: AppPopupRow): AppPopup {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    imageUrl: r.image_url,
    youtubeUrl: r.youtube_url,
    linkUrl: r.link_url,
    linkLabel: r.link_label,
  };
}

/**
 * Extract a YouTube video id from the common URL shapes
 * (watch?v=, youtu.be/, /embed/, /shorts/). Returns null if it doesn't
 * look like a YouTube link.
 */
export function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  // Bare 11-char id.
  if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

/** Privacy-friendly embed URL for a YouTube video, or null. */
export function youtubeEmbedUrl(url: string | null): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

/** True for an absolute external link (open in a new tab). */
export function isExternalLink(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** A same-app path (/…) or an absolute http(s) URL — the accepted forms
 *  for popup image/link fields. Rejects protocol-relative and js: URIs. */
export function isAllowedUrl(url: string): boolean {
  return (
    (url.startsWith('/') && !url.startsWith('//')) ||
    /^https?:\/\/.+/i.test(url)
  );
}
