import { promises as fs } from 'node:fs'
import path from 'node:path'
import { marked } from 'marked'

const DOCS_DIR = path.join(process.cwd(), 'docs')

export interface DocPage {
  slug: string
  title: string
  description?: string
  order: number
  section: string
}

export interface DocContent extends DocPage {
  html: string
  toc: Array<{ id: string; text: string; depth: number }>
}

// Hand-curated because file order on disk is not reading order.
const ORDER: Record<string, { order: number; section: string; description: string }> = {
  'getting-started': {
    order: 1,
    section: 'Setup',
    description: 'Fork, install, run the template locally in about 15 minutes.',
  },
  'supabase-setup': {
    order: 2,
    section: 'Setup',
    description: 'Create the database, apply migrations, grab the keys.',
  },
  'whatsapp-setup': {
    order: 3,
    section: 'Setup',
    description: 'Meta app, access token, webhook verification.',
  },
  'environment-variables': {
    order: 4,
    section: 'Setup',
    description: 'Full reference for every env var the app reads.',
  },
  'deployment-hostinger': {
    order: 5,
    section: 'Deploy',
    description: 'Ship the template on Hostinger Managed Node.js Hosting.',
  },
  'automations-and-cron': {
    order: 6,
    section: 'Deploy',
    description: 'Schedule the drain so Wait steps resume on time.',
  },
  architecture: {
    order: 7,
    section: 'Reference',
    description: 'Stack, folder layout, request lifecycle.',
  },
  troubleshooting: {
    order: 8,
    section: 'Reference',
    description: 'The usual suspects when something breaks.',
  },
}

// Tailwind classes applied after marked renders.
// Listed as full class strings so Tailwind's source scanner picks them up.
const CLASSES = {
  h1: 'text-3xl sm:text-4xl font-bold tracking-tight text-white mt-1 mb-4 scroll-mt-20',
  h2: 'text-2xl font-semibold tracking-tight text-white mt-10 mb-3 pt-6 border-t border-slate-800 scroll-mt-20',
  h3: 'text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20',
  p: 'my-3 text-slate-300 leading-relaxed',
  ul: 'my-3 pl-6 list-disc marker:text-slate-500 text-slate-300 leading-relaxed space-y-1.5',
  ol: 'my-3 pl-6 list-decimal marker:text-slate-500 text-slate-300 leading-relaxed space-y-1.5',
  li: 'pl-1',
  blockquote: 'my-4 rounded-r-lg border-l-4 border-emerald-500 bg-emerald-500/5 px-4 py-3 text-slate-200',
  hr: 'my-8 border-t border-slate-800',
  a: 'text-emerald-400 underline decoration-transparent underline-offset-2 transition-colors hover:decoration-emerald-500/60',
  codespan: 'rounded-md border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[0.85em] font-mono text-slate-100',
  pre: 'my-5 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/80 p-4 text-[0.825rem] leading-relaxed font-mono text-slate-100',
  table: 'my-5 block w-full overflow-x-auto rounded-lg border border-slate-800 text-sm',
  th: 'border-b border-slate-800 px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white bg-slate-900/60',
  td: 'border-b border-slate-800 px-3.5 py-2.5 text-left align-top text-slate-300',
  strong: 'font-semibold text-white',
}

let pagesCache: DocPage[] | null = null

export async function listDocs(): Promise<DocPage[]> {
  if (pagesCache) return pagesCache
  const entries = await fs.readdir(DOCS_DIR)
  const pages: DocPage[] = []
  for (const file of entries) {
    if (!file.endsWith('.md') || file === 'README.md') continue
    const slug = file.replace(/\.md$/, '')
    const meta = ORDER[slug]
    if (!meta) continue
    const raw = await fs.readFile(path.join(DOCS_DIR, file), 'utf8')
    const title = extractTitle(raw) ?? slug
    pages.push({
      slug,
      title,
      description: meta.description,
      order: meta.order,
      section: meta.section,
    })
  }
  pages.sort((a, b) => a.order - b.order)
  pagesCache = pages
  return pages
}

export async function loadDoc(slug: string): Promise<DocContent | null> {
  const pages = await listDocs()
  const meta = pages.find((p) => p.slug === slug)
  if (!meta) return null
  const raw = await fs.readFile(path.join(DOCS_DIR, `${slug}.md`), 'utf8')

  // Resolve inter-doc links like `./supabase-setup.md` to `/docs/supabase-setup`.
  const rewritten = raw.replace(
    /\]\(\.\/([a-zA-Z0-9-_]+)\.md([^)]*)\)/g,
    (_, target: string, rest: string) => `](/docs/${target}${rest})`,
  )

  const vanilla = await marked.parse(rewritten, { gfm: true, breaks: false })
  const { html, toc } = decorate(vanilla as string)

  return { ...meta, html, toc }
}

function decorate(html: string): { html: string; toc: DocContent['toc'] } {
  const toc: DocContent['toc'] = []

  let out = html

  // Headings: add id + Tailwind classes. Collect h2/h3 for TOC.
  out = out.replace(
    /<h([1-6])>([\s\S]*?)<\/h\1>/g,
    (_, depthStr: string, inner: string) => {
      const depth = Number(depthStr)
      const text = stripTags(inner)
      const id = slugify(text)
      if (depth >= 2 && depth <= 3) toc.push({ id, text, depth })
      const cls =
        depth === 1
          ? CLASSES.h1
          : depth === 2
            ? CLASSES.h2
            : depth === 3
              ? CLASSES.h3
              : ''
      return `<h${depth} id="${id}" class="${cls}">${inner}</h${depth}>`
    },
  )

  // Drop the top border from the very first h2 so it doesn't read as a
  // divider right under the page title.
  let firstH2 = true
  out = out.replace(
    /<h2 (id="[^"]*") class="([^"]*)"/g,
    (match, idAttr: string, cls: string) => {
      if (!firstH2) return match
      firstH2 = false
      const trimmed = cls
        .replace(/(?:^|\s)border-t(?:\s|$)/, ' ')
        .replace(/(?:^|\s)border-slate-800(?:\s|$)/, ' ')
        .replace(/(?:^|\s)pt-6(?:\s|$)/, ' ')
        .replace(/(?:^|\s)mt-10(?:\s|$)/, ' mt-6 ')
        .trim()
        .replace(/\s+/g, ' ')
      return `<h2 ${idAttr} class="${trimmed}"`
    },
  )

  out = out.replace(/<p>/g, `<p class="${CLASSES.p}">`)
  out = out.replace(/<ul>/g, `<ul class="${CLASSES.ul}">`)
  out = out.replace(/<ol>/g, `<ol class="${CLASSES.ol}">`)
  out = out.replace(/<li>/g, `<li class="${CLASSES.li}">`)
  out = out.replace(/<blockquote>/g, `<blockquote class="${CLASSES.blockquote}">`)
  out = out.replace(/<hr>/g, `<hr class="${CLASSES.hr}" />`)
  out = out.replace(/<strong>/g, `<strong class="${CLASSES.strong}">`)
  out = out.replace(/<table>/g, `<table class="${CLASSES.table}">`)
  out = out.replace(/<th>/g, `<th class="${CLASSES.th}">`)
  out = out.replace(/<th align="([^"]+)">/g, `<th align="$1" class="${CLASSES.th}">`)
  out = out.replace(/<td>/g, `<td class="${CLASSES.td}">`)
  out = out.replace(/<td align="([^"]+)">/g, `<td align="$1" class="${CLASSES.td}">`)

  // Inline <code> from marked comes wrapped in <pre> for code blocks, or
  // bare for codespan. We distinguish by whether <pre> precedes it.
  out = out.replace(
    /<pre><code( class="language-[^"]*")?>/g,
    (_, langAttr = '') =>
      `<pre class="${CLASSES.pre}"><code${langAttr}>`,
  )
  // Remaining <code> tags are inline codespans.
  out = out.replace(
    /<code(?! class="language-)([^>]*)>/g,
    (_, rest: string) => `<code${rest} class="${CLASSES.codespan}">`,
  )

  // Links: style + open http(s) in new tabs.
  out = out.replace(
    /<a href="([^"]+)"([^>]*)>/g,
    (_, href: string, rest: string) => {
      const isExternal = /^https?:\/\//i.test(href)
      const extra = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${href}"${rest} class="${CLASSES.a}"${extra}>`
    },
  )

  return { html: out, toc }
}

function extractTitle(raw: string): string | null {
  const match = raw.match(/^#\s+(.+?)\s*$/m)
  return match ? match[1].trim() : null
}

function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim()
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
