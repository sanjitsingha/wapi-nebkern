'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ============================================================
// The image and link pickers.
//
// Both replaced `window.prompt`, which could only ask for a URL — so
// inserting an image meant uploading it somewhere else first, copying
// the address, and finding out whether you got it right only after it
// was already in the document.
//
// Here the upload happens in the dialog and you see the actual image
// before committing, so the document never has to be the place you
// discover a mistake.
// ============================================================

/**
 * Upload one file to R2 via the admin presign route and return its
 * public URL. Shared by the cover picker and the in-body image dialog;
 * `kind` only decides which prefix it lands under.
 */
export async function uploadImage(
  file: File,
  kind: 'cover' | 'inline'
): Promise<string | null> {
  const res = await fetch('/admin/api/blog/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: file.type, size: file.size, kind }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast.error(data.error ?? 'Could not start the upload');
    return null;
  }

  // Content-Type has to match what the URL was signed for or R2 rejects
  // the PUT.
  const put = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!put.ok) {
    toast.error('Upload failed');
    return null;
  }
  return data.publicUrl as string;
}

/* ─── Image ──────────────────────────────────────────────────── */

/**
 * Only ever mounted while open (see EditorToolbar), so first render is
 * a clean slate — no effect syncing props into state, and no chance of
 * the previous insert's image sitting here ready to be added twice.
 */
export function ImageDialog({
  onOpenChange,
  onInsert,
}: {
  onOpenChange: (open: boolean) => void;
  onInsert: (url: string, alt: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const publicUrl = await uploadImage(file, 'inline');
      if (publicUrl) setUrl(publicUrl);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Insert image</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          {/* Drop target doubles as the preview once there is one. */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className="border-border hover:border-primary relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors disabled:cursor-wait"
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt=""
                className="absolute inset-0 size-full object-contain"
              />
            ) : (
              <span className="text-muted-foreground flex flex-col items-center gap-2 text-xs">
                {uploading ? (
                  <Loader2 className="size-6 animate-spin" />
                ) : (
                  <ImagePlus className="size-6" />
                )}
                {uploading ? 'Uploading…' : 'Click or drop an image to upload'}
              </span>
            )}
          </button>

          <div className="space-y-1.5">
            <Label className="text-xs">Or paste an image URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…/photo.jpg"
              className="border-border bg-muted text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Alt text{' '}
              <span className="text-muted-foreground">
                — what the image shows, for screen readers and search
              </span>
            </Label>
            <Input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="A phone showing a WhatsApp chat"
              className="border-border bg-muted text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-border"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!url.trim() || uploading}
            onClick={() => {
              onInsert(url.trim(), alt.trim());
              onOpenChange(false);
            }}
          >
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Link ───────────────────────────────────────────────────── */

/** Mounted only while open, so `initialHref` is read once at mount —
 *  see the note on ImageDialog. */
export function LinkDialog({
  onOpenChange,
  initialHref,
  hasLink,
  onSubmit,
  onRemove,
}: {
  onOpenChange: (open: boolean) => void;
  initialHref: string;
  /** Whether the caret is inside an existing link — decides if the
   *  Remove action is offered. */
  hasLink: boolean;
  onSubmit: (href: string) => void;
  onRemove: () => void;
}) {
  const [href, setHref] = useState(initialHref);

  const valid =
    /^https?:\/\//i.test(href.trim()) || href.trim().startsWith('/');

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hasLink ? 'Edit link' : 'Add link'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-xs">Links to</Label>
          <Input
            autoFocus
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) {
                e.preventDefault();
                onSubmit(href.trim());
                onOpenChange(false);
              }
            }}
            placeholder="https://example.com  or  /pricing"
            className="border-border bg-muted text-xs"
          />
          <p className="text-muted-foreground text-[11px]">
            An external address, or a path on this site starting with /.
          </p>
        </div>

        <DialogFooter>
          {hasLink && (
            <Button
              type="button"
              variant="outline"
              className="border-border mr-auto"
              onClick={() => {
                onRemove();
                onOpenChange(false);
              }}
            >
              <Trash2 className="size-4" />
              Remove link
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="border-border"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!valid}
            onClick={() => {
              onSubmit(href.trim());
              onOpenChange(false);
            }}
          >
            {hasLink ? 'Update' : 'Add link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
