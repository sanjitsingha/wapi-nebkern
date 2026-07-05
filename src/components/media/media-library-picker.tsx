'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { MediaKind, MediaLibraryItem } from '@/types';
import {
  listLibrary,
  uploadToLibrary,
  formatBytes,
  MEDIA_KIND_SPECS,
} from '@/lib/media/library';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, Search, FileText, FolderOpen } from 'lucide-react';

/**
 * Modal picker for choosing a media-library file of a given kind —
 * used by the template builder's media header. Lists the account's
 * saved files, lets you search or upload a new one, and calls
 * `onSelect(item)` with the chosen file (whose `public_url` the caller
 * drops into the template's header_media_url).
 */
export function MediaLibraryPicker({
  open,
  onOpenChange,
  kind,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: MediaKind;
  onSelect: (item: MediaLibraryItem) => void;
}) {
  const [items, setItems] = useState<MediaLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listLibrary());
    } catch {
      toast.error('Failed to load media');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) => i.kind === kind && (q === '' || i.name.toLowerCase().includes(q)),
    );
  }, [items, kind, search]);

  const pick = (item: MediaLibraryItem) => {
    onSelect(item);
    onOpenChange(false);
  };

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const item = await uploadToLibrary(file);
      if (item.kind !== kind) {
        // Uploaded, but it's the wrong kind for this header — keep it in
        // the library and tell the user rather than silently selecting.
        setItems((prev) => [item, ...prev]);
        toast.error(`That's a ${item.kind}, not a ${kind}.`);
        return;
      }
      toast.success('Uploaded');
      pick(item);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="capitalize text-popover-foreground">
            Pick {kind} from library
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Choose a saved {kind}, or upload a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-10 border-border bg-background pl-8 text-foreground"
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={MEDIA_KIND_SPECS[kind].accept}
            className="hidden"
            onChange={(e) => {
              handleUpload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="h-10 shrink-0 border-border"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Upload
          </Button>
        </div>

        <div className="max-h-[22rem] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <FolderOpen className="size-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No {kind}s in your library yet. Upload one above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pick(item)}
                  className="group overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary"
                >
                  <div className="relative aspect-square bg-muted">
                    {item.kind === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.public_url}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : item.kind === 'video' ? (
                      <video
                        src={item.public_url}
                        muted
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <FileText className="size-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-foreground" title={item.name}>
                      {item.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatBytes(item.size_bytes)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
