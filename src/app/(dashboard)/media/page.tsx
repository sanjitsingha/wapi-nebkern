'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { MediaKind, MediaLibraryItem } from '@/types';
import {
  listLibrary,
  uploadToLibrary,
  deleteFromLibrary,
  formatBytes,
  ALL_MEDIA_ACCEPT,
} from '@/lib/media/library';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GatedButton } from '@/components/ui/gated-button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCan } from '@/hooks/use-can';
import {
  Upload,
  Search,
  Copy,
  Check,
  Trash2,
  Loader2,
  Image as ImageIcon,
  Film,
  FileText,
  ExternalLink,
  FolderOpen,
  LayoutGrid,
  List,
  FileType,
  HardDrive,
  Ruler,
  CalendarDays,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type KindFilter = 'all' | MediaKind;
type View = 'grid' | 'list';

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
  { value: 'document', label: 'Documents' },
];

const KIND_ICON = {
  image: ImageIcon,
  video: Film,
  document: FileText,
} as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MediaPage() {
  const canManage = useCan('send-messages');

  const [items, setItems] = useState<MediaLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [view, setView] = useState<View>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaLibraryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = useCallback(async () => {
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
    fetchItems();
  }, [fetchItems]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      let ok = 0;
      for (const file of Array.from(files)) {
        try {
          const item = await uploadToLibrary(file);
          setItems((prev) => [item, ...prev]);
          ok += 1;
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : `Couldn't upload ${file.name}`,
          );
        }
      }
      if (ok > 0) {
        toast.success(`${ok} file${ok === 1 ? '' : 's'} uploaded`);
      }
      setUploading(false);
    },
    [],
  );

  async function copyLink(item: MediaLibraryItem) {
    await navigator.clipboard.writeText(item.public_url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 2000);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFromLibrary(deleteTarget);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      toast.success('File deleted');
    } catch {
      toast.error('Failed to delete file');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (kindFilter === 'all' || i.kind === kindFilter) &&
        (q === '' || i.name.toLowerCase().includes(q)),
    );
  }, [items, search, kindFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Media</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload images, videos, and documents once — then reuse their links
            in message templates.
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALL_MEDIA_ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <GatedButton
          canAct={canManage}
          gateReason="upload media"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="h-11 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Upload files
        </GatedButton>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file name…"
            className="h-11 border-border bg-card pl-8 text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setKindFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                kindFilter === f.value
                  ? 'bg-primary-soft text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 sm:ml-auto">
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            className={`flex size-8 items-center justify-center rounded-md transition-colors ${
              view === 'grid'
                ? 'bg-primary-soft text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            aria-label="List view"
            aria-pressed={view === 'list'}
            className={`flex size-8 items-center justify-center rounded-md transition-colors ${
              view === 'list'
                ? 'bg-primary-soft text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <FolderOpen className="size-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? 'No media yet. Upload your first file to reuse it in templates.'
              : 'No files match your filters.'}
          </p>
          {items.length === 0 && (
            <GatedButton
              canAct={canManage}
              gateReason="upload media"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 border-border"
            >
              <Upload className="size-3.5" />
              Upload files
            </GatedButton>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <div
                key={item.id}
                className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
              >
                {/* Preview */}
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
                      <FileText className="size-10 text-muted-foreground" />
                    </div>
                  )}
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium capitalize text-foreground backdrop-blur-sm">
                    <Icon className="size-3" />
                    {item.kind}
                  </span>
                  {/* Hover actions */}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/55 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <a
                      href={item.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open"
                      className="flex size-8 items-center justify-center rounded-md bg-white/90 text-neutral-800 transition-colors hover:bg-white"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                    <button
                      type="button"
                      title="Copy link"
                      onClick={() => copyLink(item)}
                      className="flex size-8 items-center justify-center rounded-md bg-white/90 text-neutral-800 transition-colors hover:bg-white"
                    >
                      {copiedId === item.id ? (
                        <Check className="size-4 text-primary" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setDeleteTarget(item)}
                        className="flex size-8 items-center justify-center rounded-md bg-white/90 text-red-600 transition-colors hover:bg-white"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Meta */}
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-foreground" title={item.name}>
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatBytes(item.size_bytes)}
                    {item.width && item.height
                      ? ` · ${item.width}×${item.height}`
                      : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyLink(item)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="size-3.5 text-primary" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" /> Copy link
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-14" />
                <TableHead className="text-muted-foreground" icon={FileText}>Name</TableHead>
                <TableHead className="text-muted-foreground" icon={FileType}>Type</TableHead>
                <TableHead className="text-muted-foreground hidden sm:table-cell" icon={HardDrive}>
                  Size
                </TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell" icon={Ruler}>
                  Dimensions
                </TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell" icon={CalendarDays}>
                  Added
                </TableHead>
                <TableHead className="text-muted-foreground text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const Icon = KIND_ICON[item.kind];
                return (
                  <TableRow key={item.id} className="border-border hover:bg-muted/40">
                    {/* Thumbnail */}
                    <TableCell>
                      <div className="size-9 shrink-0 overflow-hidden rounded-md bg-muted">
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
                            <FileText className="size-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-56 truncate font-medium text-foreground" title={item.name}>
                      {item.name}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
                        <Icon className="size-3" />
                        {item.kind}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground tabular-nums sm:table-cell">
                      {formatBytes(item.size_bytes)}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground tabular-nums lg:table-cell">
                      {item.width && item.height ? `${item.width}×${item.height}` : '—'}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {formatDate(item.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => copyLink(item)}
                          title="Copy link"
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          {copiedId === item.id ? (
                            <Check className="size-4 text-primary" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </button>
                        <a
                          href={item.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open"
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            title="Delete"
                            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">Delete file</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Delete{' '}
              <span className="font-medium text-popover-foreground">
                {deleteTarget?.name}
              </span>
              ? Any template still pointing at its link will stop showing the
              media. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
