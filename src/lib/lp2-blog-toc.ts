// ============================================================
// Table-of-contents extraction for /lp-2 blog articles.
//
// Post bodies are admin-authored HTML strings. To build a ToC that
// links into them we (1) find every h2/h3/h4, (2) give each a stable,
// unique id, and (3) return both the rewritten HTML and the flat list
// of headings. Pure and server-safe — no DOM, just string work — so
// the article page can call it while rendering.
// ============================================================

export interface TocItem {
  id: string;
  text: string;
  /** Heading level: 2, 3 or 4. Drives the ToC indent. */
  level: number;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/** Strip tags, decode the handful of common entities, collapse space. */
function toText(inner: string): string {
  return inner
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g, (m) => ENTITIES[m] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

/**
 * Rewrite `html` so every h2–h4 carries a unique id, and return the
 * headings as a flat list. Existing ids on a heading are replaced so the
 * ToC anchors always match.
 */
export function buildToc(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Set<string>();

  const out = html.replace(
    /<(h[234])\b([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag: string, attrs: string, inner: string) => {
      const text = toText(inner);
      if (!text) return match;

      // Make the id unique — repeated headings would otherwise all
      // anchor to the first one.
      const base = slugify(text);
      let id = base;
      let n = 1;
      while (used.has(id)) id = `${base}-${++n}`;
      used.add(id);

      toc.push({ id, text, level: Number(tag[1]) });

      const attrsNoId = attrs.replace(/\sid=("[^"]*"|'[^']*')/i, '');
      return `<${tag}${attrsNoId} id="${id}">${inner}</${tag}>`;
    },
  );

  return { html: out, toc };
}
