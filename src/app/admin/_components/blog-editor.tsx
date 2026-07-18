'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Bold,
  Italic,
  Heading2,
  Heading3,
  Quote,
  List,
  Link2,
  RemoveFormatting,
  Image as ImageIcon,
  Minus,
  Loader2,
  Eye,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import '@/app/blog/post-content.css';

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
 * Medium-style blog editor. A borderless title, a contentEditable body
 * with a floating bubble toolbar on text selection (bold / italic /
 * headings / quote / list / link), and an insert row for images and
 * dividers. Content is stored as HTML — the same .post-content styles
 * render it here and on the public article, so the editor is WYSIWYG.
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
    post?.status ?? 'draft',
  );
  const [metaOpen, setMetaOpen] = useState(!post);
  const [saving, setSaving] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Bubble toolbar position (null = hidden). Coordinates are relative
  // to the wrapper so the toolbar scrolls with the content.
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(
    null,
  );

  // Seed the editable surface once — controlled innerHTML would reset
  // the caret on every keystroke, so content lives in the DOM and is
  // read back on save.
  useEffect(() => {
    if (editorRef.current && post?.content_html) {
      editorRef.current.innerHTML = post.content_html;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track selection → show/hide/position the bubble toolbar.
  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection();
      const editor = editorRef.current;
      const wrapper = wrapperRef.current;
      if (!sel || sel.isCollapsed || !editor || !wrapper) {
        setBubble(null);
        return;
      }
      const anchor = sel.anchorNode;
      if (!anchor || !editor.contains(anchor)) {
        setBubble(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setBubble(null);
        return;
      }
      const wrapRect = wrapper.getBoundingClientRect();
      setBubble({
        top: rect.top - wrapRect.top - 10,
        left: rect.left - wrapRect.left + rect.width / 2,
      });
    }
    document.addEventListener('selectionchange', onSelectionChange);
    return () =>
      document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  const exec = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }, []);

  const addLink = useCallback(() => {
    const url = window.prompt('Link URL (https://…)');
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
      toast.error('Use an http(s) URL or a path starting with /');
      return;
    }
    exec('createLink', url);
  }, [exec]);

  const insertImage = useCallback(() => {
    const url = window.prompt('Image URL (https://…)');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast.error('Use a public http(s) image URL');
      return;
    }
    exec('insertImage', url);
  }, [exec]);

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
        content_html: editorRef.current?.innerHTML ?? '',
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
        },
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

  const bubbleButtons: {
    icon: typeof Bold;
    label: string;
    action: () => void;
  }[] = [
    { icon: Bold, label: 'Bold', action: () => exec('bold') },
    { icon: Italic, label: 'Italic', action: () => exec('italic') },
    { icon: Heading2, label: 'Heading', action: () => exec('formatBlock', 'H2') },
    {
      icon: Heading3,
      label: 'Subheading',
      action: () => exec('formatBlock', 'H3'),
    },
    {
      icon: Quote,
      label: 'Quote',
      action: () => exec('formatBlock', 'BLOCKQUOTE'),
    },
    { icon: List, label: 'Bullet list', action: () => exec('insertUnorderedList') },
    { icon: Link2, label: 'Link', action: addLink },
    {
      icon: RemoveFormatting,
      label: 'Clear formatting',
      action: () => {
        exec('removeFormat');
        exec('formatBlock', 'P');
      },
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/admin/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
                : 'bg-muted text-muted-foreground',
            )}
          >
            {status === 'published' ? 'Published' : 'Draft'}
          </span>
          {status === 'published' && slug && (
            <Link
              href={`/blog/${slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
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
        </div>
      </div>

      {/* Post settings (slug / excerpt / cover / author / tags) */}
      <div className="mb-6 rounded-xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setMetaOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
        >
          Post settings
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              metaOpen && 'rotate-180',
            )}
          />
        </button>
        {metaOpen && (
          <div className="space-y-4 border-t border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-foreground">Slug</Label>
                <Input
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase());
                    setSlugDirty(true);
                  }}
                  placeholder="my-first-post"
                  className="border-border bg-muted font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-foreground">Author</Label>
                <Input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Jane from wacrm"
                  className="border-border bg-muted"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-foreground">
                Excerpt (shown on the blog list + social previews)
              </Label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                maxLength={400}
                className="w-full resize-none rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-foreground">Cover image URL</Label>
                <Input
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://…/cover.jpg"
                  className="border-border bg-muted"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-foreground">
                  Tags (comma separated)
                </Label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="product, whatsapp"
                  className="border-border bg-muted"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Title */}
      <textarea
        value={title}
        onChange={(e) => {
          setTitle(e.target.value.replace(/\n/g, ' '));
          if (!slugDirty) setSlug(slugify(e.target.value));
        }}
        placeholder="Title"
        rows={1}
        className="mb-2 w-full resize-none bg-transparent text-4xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40"
      />

      {/* Insert row */}
      <div className="mb-3 flex items-center gap-1 border-b border-border pb-3">
        <span className="mr-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Insert
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={insertImage}
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ImageIcon className="size-3.5" />
          Image
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => exec('insertHorizontalRule')}
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Minus className="size-3.5" />
          Divider
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Select text for formatting
        </span>
      </div>

      {/* Editable body + bubble toolbar */}
      <div ref={wrapperRef} className="relative">
        {bubble && (
          <div
            className="absolute z-30 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg"
            style={{ top: bubble.top, left: bubble.left }}
            // Keep the selection: prevent the toolbar from stealing focus.
            onMouseDown={(e) => e.preventDefault()}
          >
            {bubbleButtons.map((b) => (
              <button
                key={b.label}
                type="button"
                title={b.label}
                aria-label={b.label}
                onClick={b.action}
                className="flex size-7 items-center justify-center rounded-md text-popover-foreground transition-colors hover:bg-muted"
              >
                <b.icon className="size-3.5" />
              </button>
            ))}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Tell your story…"
          className="post-content pb-24"
        />
      </div>
    </div>
  );
}
