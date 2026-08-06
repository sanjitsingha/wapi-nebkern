'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { TableKit } from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import {
  ArrowLeft,
  Link2,
  Image as ImageIcon,
  Loader2,
  Eye,
  ChevronDown,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  Tags,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Callout, CtaButton } from './editor-extensions';
import { EditorToolbar } from './editor-toolbar';
import { uploadImage } from './editor-dialogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import '@/styles/post-content.css';

export interface BlogPostRecord {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string;
  cover_image_url: string | null;
  author_name: string | null;
  tags: string[];
  status: 'draft' | 'published';
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Medium-style blog editor: a borderless title, a persistent formatting
 * toolbar, and a contentEditable body. Content is stored as HTML — the
 * same .post-content styles render it here and on the public article,
 * so the editor is WYSIWYG. The surface is white for the same reason:
 * you should be looking at the page, not at a form.
 *
 * LAYOUT: the writing column takes whatever width is left, with
 * everything that is *about* the post — cover, URL, author, SEO — in a
 * 35% rail on the right. Those settings used to be a block stacked
 * above the title, which pushed the thing you came here to do below the
 * fold. Beside the editor they can stay open while you write, and the
 * rail unmounts entirely when closed (its expand control lives in the
 * action bar, so there is nothing to leave behind).
 *
 * The root cancels the shell's own padding so the rail's divider runs
 * edge to edge; the writing column re-applies its own.
 */
export function BlogEditor({ post }: { post: BlogPostRecord | null }) {
  const router = useRouter();

  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [slugDirty, setSlugDirty] = useState(!!post);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [coverUrl, setCoverUrl] = useState(post?.cover_image_url ?? '');
  const [author, setAuthor] = useState(post?.author_name ?? '');
  const [tags, setTags] = useState((post?.tags ?? []).join(', '));
  const [status, setStatus] = useState<'draft' | 'published'>(
    post?.status ?? 'draft'
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    // Next renders this on the server first; without it TipTap warns
    // about a hydration mismatch it cannot avoid.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        // Clicking a link inside the editor should put the caret in it,
        // not navigate away from the draft.
        link: { openOnClick: false },
      }),
      Placeholder.configure({ placeholder: 'Tell your story…' }),
      Highlight,
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      Callout,
      CtaButton,
    ],
    content: post?.content_html ?? '',
    editorProps: {
      attributes: {
        class: 'post-content pt-8 pb-24 text-neutral-900 outline-none',
      },
    },
  });

  /**
   * Cover upload: ask our route for a one-shot permission slip, then
   * PUT the bytes straight to R2. The file never passes through the
   * app server, which is what keeps it clear of the request-body
   * ceiling serverless hosts impose.
   */
  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const publicUrl = await uploadImage(file, 'cover');
      if (publicUrl) {
        // Set locally only — persisted by the next Save/Publish, same
        // as every other field here.
        setCoverUrl(publicUrl);
        toast.success('Cover uploaded');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function save(nextStatus: 'draft' | 'published') {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error('Give the post a title');
      return;
    }
    const cleanSlug = slug.trim() || slugify(cleanTitle);
    if (!cleanSlug) {
      toast.error('Add a slug');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: cleanTitle,
        slug: cleanSlug,
        excerpt: excerpt.trim() || null,
        content_html: editor?.getHTML() ?? '',
        cover_image_url: coverUrl.trim() || null,
        author_name: author.trim() || null,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        status: nextStatus,
      };

      const res = await fetch(
        post ? `/admin/api/blog/${post.id}` : '/admin/api/blog',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Save failed');
        return;
      }
      setStatus(nextStatus);
      setSlug(cleanSlug);
      toast.success(nextStatus === 'published' ? 'Published' : 'Draft saved');
      if (!post && data.post?.id) {
        router.replace(`/admin/blog/editor?id=${data.post.id}`);
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    // `-m-4 sm:-m-6` cancels the admin shell's padding so the rail sits
    // flush against the right edge; the writing column adds its own.
    <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] sm:-m-6">
      {/* ── Writing column ───────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky so Publish stays reachable from anywhere in a long
            post — the admin header above scrolls away, this doesn't. */}
        <div className="border-border bg-background/95 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3 backdrop-blur">
          <Link
            href="/admin/blog"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="size-4" />
            All posts
          </Link>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium',
                status === 'published'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {status === 'published' ? 'Published' : 'Draft'}
            </span>
            {status === 'published' && slug && (
              <Link
                href={`/blog/${slug}`}
                target="_blank"
                className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium"
              >
                <Eye className="size-3.5" />
                View
              </Link>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => save('draft')}
              className="border-border"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save draft
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => save('published')}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Publish
            </Button>

            {/* Only shown once the rail is folded away — with the rail
              open its own header carries the close control. */}
            {!panelOpen && (
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                title="Show post settings"
                aria-label="Show post settings"
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors"
              >
                <PanelRightOpen className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Writing surface. White rather than the app's `background`
            so it matches the page the post will be published on — you
            are looking at the article, not at a form. */}
        <div className="flex flex-1 flex-col bg-white">
          {/* Title. Generous top room: the action bar above is sticky
              and sits right on top of it otherwise. */}
          <div className="px-8 pt-14 pb-8 sm:px-12">
            <textarea
              value={title}
              onChange={(e) => {
                setTitle(e.target.value.replace(/\n/g, ' '));
                if (!slugDirty) setSlug(slugify(e.target.value));
              }}
              placeholder="Title"
              rows={1}
              className="placeholder:text-muted-foreground/40 w-full resize-none bg-transparent text-4xl leading-tight font-bold tracking-tight text-neutral-900 outline-none"
            />
          </div>

          {/* Toolbar — a real row spanning the column, replacing the
              bubble that used to appear over a selection. The bubble
              was only discoverable if you already knew to highlight
              text first, and it covered the line above the one being
              formatted. Sticks under the action bar (py-3 + h-8 button
              ≈ 3.5rem) so it stays reachable down a long post. */}
          {editor && <EditorToolbar editor={editor} />}

          {/* Editable body */}
          <div className="px-8 sm:px-12">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* ── Settings rail ────────────────────────────────────── */}
      {/* Collapses to nothing at all rather than to a strip — the
          expand control lives in the action bar beside Publish, so a
          leftover rail would be a second way to do the same thing,
          costing width for nothing. */}
      {panelOpen && (
        <aside className="border-border bg-card w-[35%] max-w-[560px] min-w-80 shrink-0 border-l">
          {/* Sticky + its own scroll: a long SEO section must not force
              the page to scroll away from the paragraph being edited. */}
          <div className="sticky top-0 max-h-screen overflow-y-auto">
            <>
              <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Post settings
                </span>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  title="Hide post settings"
                  aria-label="Hide post settings"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors"
                >
                  <PanelRightClose className="size-4" />
                </button>
              </div>

              <Section title="Cover image" icon={ImageIcon} defaultOpen>
                {/* No URL field — the picker is the whole control. The
                    file goes straight to R2 and the public URL it comes
                    back with is what gets saved. */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadCover(file);
                  }}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="group border-border hover:border-primary relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border border-dashed transition-colors disabled:cursor-wait"
                >
                  {coverUrl.trim() && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverUrl}
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}

                  {/* Once a cover is set this overlays it, so the same
                      control both adds and replaces. */}
                  <span
                    className={cn(
                      'relative flex flex-col items-center gap-1.5 rounded-md px-3 py-2 transition-opacity',
                      coverUrl.trim()
                        ? 'bg-black/45 text-white opacity-0 group-hover:opacity-100'
                        : 'text-muted-foreground group-hover:text-primary'
                    )}
                  >
                    {uploading ? (
                      <Loader2 className="size-6 animate-spin" />
                    ) : (
                      <Plus className="size-6" />
                    )}
                    <span className="text-[11px] font-medium">
                      {uploading
                        ? 'Uploading…'
                        : coverUrl.trim()
                          ? 'Replace'
                          : 'Add cover image'}
                    </span>
                  </span>
                </button>

                {coverUrl.trim() && !uploading && (
                  <button
                    type="button"
                    onClick={() => setCoverUrl('')}
                    className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-2"
                  >
                    Remove cover
                  </button>
                )}
              </Section>

              <Section title="URL" icon={Link2} defaultOpen>
                <Input
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase());
                    setSlugDirty(true);
                  }}
                  placeholder="my-first-post"
                  className="border-border bg-muted font-mono text-xs"
                />
                <p className="text-muted-foreground truncate text-[11px]">
                  /blog/{slug || 'my-first-post'}
                </p>
              </Section>

              <Section title="Author" icon={UserRound} defaultOpen>
                <Input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Jane from wacrm"
                  className="border-border bg-muted text-xs"
                />
              </Section>

              <Section title="SEO" icon={Search} defaultOpen>
                <Label className="text-muted-foreground text-[11px]">
                  Meta description
                </Label>
                <textarea
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  rows={4}
                  maxLength={400}
                  placeholder="One or two sentences for search results and social cards."
                  className="border-border bg-muted text-foreground focus-visible:border-primary w-full resize-none rounded-md border px-3 py-2 text-xs outline-none"
                />
                {/* Google truncates around 160; the field allows 400
                    because the blog index shows the same text in full. */}
                <p
                  className={cn(
                    'text-right text-[11px]',
                    excerpt.length > 160
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground'
                  )}
                >
                  {excerpt.length}/160 shown in search
                </p>

                <div className="border-border bg-muted/40 rounded-md border p-3">
                  <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wide uppercase">
                    Search preview
                  </p>
                  <p className="text-primary truncate text-[13px]">
                    {title.trim() || 'Post title'}
                  </p>
                  <p className="truncate text-[11px] text-emerald-700 dark:text-emerald-500">
                    instant.nebkern.com/blog/{slug || 'my-first-post'}
                  </p>
                  <p className="text-muted-foreground line-clamp-2 text-[11px]">
                    {excerpt.trim() ||
                      'Add a meta description to control what appears here.'}
                  </p>
                </div>
              </Section>

              <Section title="Tags" icon={Tags} defaultOpen={false}>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="product, whatsapp"
                  className="border-border bg-muted text-xs"
                />
                <p className="text-muted-foreground text-[11px]">
                  Comma separated.
                </p>
              </Section>
            </>
          </div>
        </aside>
      )}
    </div>
  );
}

/** One collapsible group in the settings rail. */
function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: typeof ImageIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-border border-b">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="text-foreground flex items-center gap-2 text-xs font-medium">
          <Icon className="text-muted-foreground size-3.5 shrink-0" />
          {title}
        </span>
        <ChevronDown
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && <div className="space-y-2 px-4 pb-4">{children}</div>}
    </div>
  );
}
