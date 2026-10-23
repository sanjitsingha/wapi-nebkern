'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CloudUpload,
  Ellipsis,
  FileText,
  FileUp,
  Loader2,
  MessageCircleQuestion,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { docHref } from '@/lib/docs/nav';
import { useCan } from '@/hooks/use-can';
import type { KnowledgeKind, QaPair } from '@/lib/ai/knowledge-sources';
import {
  ACCEPTED_EXTENSIONS,
  ExtractError,
  extractText,
} from '@/lib/files/extract-text';
import { Button, buttonVariants } from '@/components/ui/button';
import { DocsButton } from '@/components/ui/docs-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SettingsPanelHead } from '@/components/settings/settings-panel-head';

/**
 * Maya → Knowledge base: what she answers customers from. Three kinds
 * of source — text in your own words, question-and-answer pairs,
 * uploaded files — added from "Add knowledge" in the header (its form
 * opens above the list) and listed below.
 *
 * Stored in ai_knowledge_documents through /api/ai/knowledge, chunked
 * and indexed on save (lib/ai/knowledge.ts); see
 * lib/ai/knowledge-sources.ts for what each kind keeps. A file's text is
 * read here in the browser (lib/files/extract-text.ts) — only the text
 * is sent, never the file.
 */

type SourceKind = KnowledgeKind;

interface KnowledgeSource {
  id: string;
  kind: SourceKind;
  title: string;
  /** "2,140 characters", "8 questions", "1.2 MB". */
  detail: string;
  updatedAt: string;
  /** Being saved and indexed right now. */
  pending?: boolean;
}

/** A row of GET /api/ai/knowledge. */
interface SourceRowData {
  id: string;
  title: string;
  kind: SourceKind;
  updated_at: string;
  chars: number;
  questions: number | null;
  size_bytes: number | null;
}

/** What an Edit opens the form with — fetched from GET /[id]. */
interface Editing {
  source: KnowledgeSource;
  content?: string;
  pairs?: QaPair[];
}

const KINDS: Record<
  SourceKind,
  { label: string; icon: LucideIcon; blurb: string }
> = {
  text: {
    label: 'Text',
    icon: FileText,
    blurb: 'Policies, product details, anything in your own words',
  },
  qa: {
    label: 'Q&A',
    icon: MessageCircleQuestion,
    blurb: 'Questions customers ask, with the answers to give',
  },
  file: {
    label: 'Files',
    icon: FileUp,
    blurb: 'PDF, Word, TXT, MD or CSV, up to 10 MB each',
  },
};

const KIND_ORDER: SourceKind[] = ['text', 'qa', 'file'];

const ADD_TITLES: Record<SourceKind, string> = {
  text: 'Add text',
  qa: 'Add Q&A',
  file: 'Upload files',
};
const EDIT_TITLES: Record<SourceKind, string> = {
  text: 'Edit text',
  qa: 'Edit Q&A',
  file: 'Edit file',
};

// Every kind's glyph is plain grey — no colour, no tile behind it; the
// glyph alone tells them apart. The box only keeps rows aligned.
const ICON_TILE = 'text-muted-foreground';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toSource(row: SourceRowData): KnowledgeSource {
  const detail =
    row.kind === 'qa' && row.questions !== null
      ? `${row.questions} ${row.questions === 1 ? 'question' : 'questions'}`
      : row.kind === 'file' && row.size_bytes !== null
        ? formatBytes(row.size_bytes)
        : `${row.chars.toLocaleString()} characters`;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    detail,
    updatedAt: row.updated_at,
  };
}

/** POST/PATCH a source; true on success, after any warning is shown. */
async function send(
  url: string,
  method: 'POST' | 'PATCH',
  body: unknown
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? 'Could not save.');
      return false;
    }
    if (data.warning) toast.warning(data.warning, { duration: 8000 });
    return true;
  } catch {
    toast.error(
      'Could not reach Dripo. Check your connection and try again.'
    );
    return false;
  }
}

export function MayaKnowledgeBase() {
  const canEdit = useCan('edit-settings');
  const [sources, setSources] = useState<KnowledgeSource[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Which form is open above the list, and the source being edited.
  const [adding, setAdding] = useState<SourceKind | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SourceKind | 'all'>('all');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/knowledge');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setSources((data.documents as SourceRowData[]).map(toSource));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const list = useMemo(() => sources ?? [], [sources]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter(
      (s) =>
        (filter === 'all' || s.kind === filter) &&
        (!q || s.title.toLowerCase().includes(q))
    );
  }, [list, query, filter]);

  function closeForm() {
    setAdding(null);
    setEditing(null);
  }

  const openForm = (kind: SourceKind) => {
    setEditing(null);
    setAdding(kind);
  };

  /** A placeholder row while a save is on its way — the "Training" one. */
  function showPending(kind: SourceKind, title: string): string {
    const id = `pending-${Math.random().toString(36).slice(2)}`;
    setSources((prev) => [
      {
        id,
        kind,
        title,
        detail: 'Saving…',
        updatedAt: new Date().toISOString(),
        pending: true,
      },
      ...(prev ?? []),
    ]);
    return id;
  }

  const dropPending = (id: string) =>
    setSources((prev) => (prev ?? []).filter((s) => s.id !== id));

  /** Create, or update the source being edited. Reloads on success. */
  async function save(
    kind: SourceKind,
    title: string,
    body: Record<string, unknown>
  ) {
    const target = editing?.source;
    const pendingId = target ? null : showPending(kind, title);
    if (target) {
      setSources((prev) =>
        (prev ?? []).map((s) =>
          s.id === target.id ? { ...s, title, pending: true } : s
        )
      );
    }
    const ok = target
      ? await send(`/api/ai/knowledge/${target.id}`, 'PATCH', body)
      : await send('/api/ai/knowledge', 'POST', { kind, ...body });
    if (pendingId) dropPending(pendingId);
    if (ok) {
      closeForm();
      toast.success(
        target ? 'Saved.' : `Added — Maya can answer from “${title}” now.`
      );
    }
    await load();
    return ok;
  }

  /** Files one after another, each reported through `onProgress`; the
   *  form closes only when every one went in. */
  async function uploadFiles(
    files: File[],
    onProgress: (name: string, state: FileState) => void
  ): Promise<void> {
    let added = 0;
    for (const file of files) {
      onProgress(file.name, { step: 'reading' });
      let content: string;
      try {
        content = await extractText(file);
      } catch (err) {
        onProgress(file.name, {
          step: 'error',
          message:
            err instanceof ExtractError
              ? err.message
              : 'This file could not be read.',
        });
        continue;
      }
      onProgress(file.name, { step: 'saving' });
      const pendingId = showPending('file', file.name);
      const ok = await send('/api/ai/knowledge', 'POST', {
        kind: 'file',
        content,
        file: { name: file.name, size: file.size },
      });
      dropPending(pendingId);
      if (ok) {
        added += 1;
        onProgress(file.name, { step: 'done' });
      } else {
        onProgress(file.name, {
          step: 'error',
          message: 'Not added — see the message above.',
        });
      }
    }
    await load();
    if (added === files.length) {
      closeForm();
      toast.success(added === 1 ? 'File added.' : `${added} files added.`);
    }
  }

  async function startEdit(source: KnowledgeSource) {
    setOpening(source.id);
    try {
      const res = await fetch(`/api/ai/knowledge/${source.id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Could not open it.');
        return;
      }
      setEditing({
        source,
        content: typeof data.content === 'string' ? data.content : '',
        pairs: Array.isArray(data.meta?.pairs)
          ? (data.meta.pairs as QaPair[])
          : undefined,
      });
      setAdding(source.kind);
    } catch {
      toast.error(
        'Could not reach Dripo. Check your connection and try again.'
      );
    } finally {
      setOpening(null);
    }
  }

  async function remove(source: KnowledgeSource) {
    if (!confirm(`Remove "${source.title}"? Maya will stop answering from it.`))
      return;
    try {
      const res = await fetch(`/api/ai/knowledge/${source.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Could not remove it.');
        return;
      }
      setSources((prev) => (prev ?? []).filter((s) => s.id !== source.id));
      if (editing?.source.id === source.id) closeForm();
      toast.success('Removed.');
    } catch {
      toast.error(
        'Could not reach Dripo. Check your connection and try again.'
      );
    }
  }

  const formTitle = adding ? (editing ? EDIT_TITLES : ADD_TITLES)[adding] : '';
  const FormIcon = adding ? KINDS[adding].icon : null;
  const ready = list.filter((s) => !s.pending).length;

  return (
    <section>
      <SettingsPanelHead
        title="Knowledge base"
        description="What Maya answers from."
        action={
          <div className="flex items-center gap-2">
            <DocsButton href={docHref('ai-agents')} />
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger className={buttonVariants({ size: 'lg' })}>
                  <Plus className="size-4" />
                  Add knowledge
                  <ChevronDown className="size-4 opacity-80" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-1.5">
                  {KIND_ORDER.map((kind) => {
                    const k = KINDS[kind];
                    return (
                      <DropdownMenuItem
                        key={kind}
                        onClick={() => openForm(kind)}
                        className="items-start gap-3 px-2.5 py-2"
                      >
                        <span
                          className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-md',
                            ICON_TILE
                          )}
                        >
                          <k.icon className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="text-foreground text-sm font-medium">
                            {k.label}
                          </span>
                          <span className="text-muted-foreground text-xs leading-snug">
                            {k.blurb}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      <div className="space-y-6">
        {/* ── The open form — from "Add knowledge", or Edit on a row ── */}
        {adding && FormIcon && (
          <div className="border-border bg-card rounded-xl border p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-md',
                  ICON_TILE
                )}
              >
                <FormIcon className="size-4" />
              </span>
              <h3 className="text-foreground flex-1 text-sm font-medium">
                {formTitle}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close"
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-md"
              >
                <X className="size-4" />
              </button>
            </div>
            {adding === 'text' && (
              <TextForm
                key={editing?.source.id ?? 'new'}
                initialTitle={editing?.source.title ?? ''}
                initialContent={editing?.content ?? ''}
                editing={Boolean(editing)}
                onSave={(title, content) =>
                  save('text', title, { title, content })
                }
                onCancel={closeForm}
              />
            )}
            {adding === 'qa' && (
              <QaForm
                key={editing?.source.id ?? 'new'}
                initialTitle={editing?.source.title ?? ''}
                initialPairs={editing?.pairs}
                editing={Boolean(editing)}
                onSave={(title, pairs) => save('qa', title, { title, pairs })}
                onCancel={closeForm}
              />
            )}
            {adding === 'file' && (
              <FileForm onUpload={uploadFiles} onCancel={closeForm} />
            )}
          </div>
        )}

        {/* ── Sources ── */}
        <div className="border-border bg-card rounded-xl border">
          <div className="border-border flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h3 className="text-foreground text-sm font-medium">Sources</h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {sources === null
                  ? 'Loading…'
                  : `${ready} ${ready === 1 ? 'source' : 'sources'} Maya answers from`}
              </p>
            </div>
            <div className="relative sm:w-60">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sources..."
                className="border-border focus-visible:border-primary h-9 rounded-none border-0 border-b bg-transparent pr-0 pl-6 text-sm focus-visible:ring-0 dark:bg-transparent"
              />
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto px-5 pt-4 sm:px-6">
            {(['all', ...KIND_ORDER] as const).map((f) => {
              const count =
                f === 'all'
                  ? list.length
                  : list.filter((s) => s.kind === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    filter === f
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f === 'all' ? 'All' : KINDS[f].label}
                  <span className="ml-1.5 opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          {sources === null && !loadFailed ? (
            <div className="flex justify-center py-12">
              <Loader2 className="text-primary size-5 animate-spin" />
            </div>
          ) : loadFailed && sources === null ? (
            <div className="px-6 py-12 text-center">
              <p className="text-foreground text-sm font-medium">
                Couldn&apos;t load the knowledge base
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="text-primary mt-1 text-xs hover:underline"
              >
                Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-foreground text-sm font-medium">
                {list.length === 0 ? 'Nothing here yet' : 'No sources match'}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {list.length === 0
                  ? canEdit
                    ? 'Use “Add knowledge” to give Maya text, Q&A or files to answer from.'
                    : 'An admin can add text, Q&A or files for Maya to answer from.'
                  : 'Try another search or filter.'}
              </p>
            </div>
          ) : (
            <ul className="divide-border mt-2 divide-y">
              {visible.map((s) => (
                <SourceRow
                  key={s.id}
                  source={s}
                  canEdit={canEdit}
                  opening={opening === s.id}
                  onEdit={() => void startEdit(s)}
                  onRemove={() => void remove(s)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── One source in the list ─────────────────────────────────────── */

function SourceRow({
  source,
  canEdit,
  opening,
  onEdit,
  onRemove,
}: {
  source: KnowledgeSource;
  canEdit: boolean;
  opening: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const k = KINDS[source.kind];
  // A file's text came from the file; it's replaced by uploading again.
  const editable = source.kind === 'text' || source.kind === 'qa';

  return (
    <li className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          ICON_TILE
        )}
      >
        <k.icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-medium">
          {source.title}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {k.label} · {source.detail}
          {!source.pending &&
            ` · Updated ${formatDistanceToNow(new Date(source.updatedAt), { addSuffix: true })}`}
        </p>
      </div>

      {source.pending ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          <Loader2 className="size-3.5 animate-spin" />
          Training
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CircleCheck className="size-3.5" />
          Ready
        </span>
      )}

      {canEdit && !source.pending ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${source.title}`}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-md transition-colors"
          >
            {opening ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Ellipsis className="size-4" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40 p-1">
            {editable && (
              <DropdownMenuItem onClick={onEdit} className="gap-2 px-2.5 py-2">
                <Pencil className="size-3.5" />
                Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={onRemove}
              className="gap-2 px-2.5 py-2 text-red-600 focus:text-red-600 dark:text-red-400"
            >
              <Trash2 className="size-3.5" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        // Keeps the status in line with the rows that do have a menu.
        <span className="size-8 shrink-0" />
      )}
    </li>
  );
}

/* ─── Forms ──────────────────────────────────────────────────────── */

function FormActions({
  onCancel,
  disabled,
  saving,
  label,
}: {
  onCancel: () => void;
  disabled: boolean;
  saving: boolean;
  label: string;
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={saving}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={disabled || saving}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
    </div>
  );
}

function TextForm({
  initialTitle,
  initialContent,
  editing,
  onSave,
  onCancel,
}: {
  initialTitle: string;
  initialContent: string;
  editing: boolean;
  onSave: (title: string, content: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const ok = title.trim() && content.trim();

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        setSaving(true);
        await onSave(title.trim(), content.trim());
        setSaving(false);
      }}
    >
      <label
        className="text-foreground text-xs font-medium"
        htmlFor="kb-text-title"
      >
        Title
      </label>
      <Input
        id="kb-text-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Returns & refunds policy"
        className="mt-1.5"
      />
      <label
        className="text-foreground mt-4 block text-xs font-medium"
        htmlFor="kb-text-content"
      >
        Content
      </label>
      <Textarea
        id="kb-text-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write or paste what Maya should know — a policy, product details, opening hours…"
        rows={8}
        className="mt-1.5"
      />
      <p className="text-muted-foreground mt-1 text-right text-xs tabular-nums">
        {content.length.toLocaleString()} characters
      </p>
      <FormActions
        onCancel={onCancel}
        disabled={!ok}
        saving={saving}
        label={editing ? 'Save changes' : 'Add text'}
      />
    </form>
  );
}

function QaForm({
  initialTitle,
  initialPairs,
  editing,
  onSave,
  onCancel,
}: {
  initialTitle: string;
  initialPairs?: QaPair[];
  editing: boolean;
  onSave: (title: string, pairs: QaPair[]) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [pairs, setPairs] = useState<QaPair[]>(
    initialPairs?.length ? initialPairs : [{ question: '', answer: '' }]
  );
  const [saving, setSaving] = useState(false);
  const filled = pairs.filter((p) => p.question.trim() && p.answer.trim());
  const ok = title.trim() && filled.length > 0;

  const update = (i: number, patch: Partial<QaPair>) =>
    setPairs((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        setSaving(true);
        await onSave(title.trim(), filled);
        setSaving(false);
      }}
    >
      <label
        className="text-foreground text-xs font-medium"
        htmlFor="kb-qa-title"
      >
        Topic
      </label>
      <Input
        id="kb-qa-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Shipping & delivery"
        className="mt-1.5"
      />

      <div className="mt-4 space-y-3">
        {pairs.map((p, i) => (
          <div key={i} className="border-border rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={p.question}
                onChange={(e) => update(i, { question: e.target.value })}
                placeholder="Question — e.g. How long does delivery take?"
                aria-label={`Question ${i + 1}`}
              />
              {pairs.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setPairs((prev) => prev.filter((_, j) => j !== i))
                  }
                  aria-label={`Remove question ${i + 1}`}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-md"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Textarea
              value={p.answer}
              onChange={(e) => update(i, { answer: e.target.value })}
              placeholder="Answer Maya should give"
              aria-label={`Answer ${i + 1}`}
              rows={2}
              className="mt-2"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          setPairs((prev) => [...prev, { question: '', answer: '' }])
        }
        className="text-primary mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
      >
        <Plus className="size-4" />
        Add another question
      </button>

      <FormActions
        onCancel={onCancel}
        disabled={!ok}
        saving={saving}
        label={
          editing
            ? 'Save changes'
            : filled.length > 1
              ? `Add ${filled.length} questions`
              : 'Add Q&A'
        }
      />
    </form>
  );
}

const MAX_BYTES = 10 * 1024 * 1024;

type FileState =
  | { step: 'waiting' }
  | { step: 'reading' }
  | { step: 'saving' }
  | { step: 'done' }
  | { step: 'error'; message: string };

function FileForm({
  onUpload,
  onCancel,
}: {
  onUpload: (
    files: File[],
    onProgress: (name: string, state: FileState) => void
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [states, setStates] = useState<Record<string, FileState>>({});
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const tooBig = files.filter((f) => f.size > MAX_BYTES);
  const ok = files.length > 0 && tooBig.length === 0;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    setFiles((prev) => [
      ...prev,
      ...picked.filter((f) => !prev.some((p) => p.name === f.name)),
    ]);
  };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        // Only what hasn't gone in yet — a second try skips the done ones.
        const todo = files.filter((f) => states[f.name]?.step !== 'done');
        setWorking(true);
        await onUpload(todo, (name, state) =>
          setStates((prev) => ({ ...prev, [name]: state }))
        );
        setWorking(false);
      }}
    >
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center transition-colors',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:bg-muted/40'
        )}
      >
        <CloudUpload className="text-muted-foreground size-6" />
        <span className="text-foreground mt-2 text-sm font-medium">
          Drop files here, or <span className="text-primary">browse</span>
        </span>
        <span className="text-muted-foreground mt-0.5 text-xs">
          PDF, Word (.docx), TXT, MD or CSV · up to 10 MB each · only the text
          is kept
        </span>
        <input
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f) => {
            const state = states[f.name];
            return (
              <li
                key={f.name}
                className="border-border flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate">
                    {f.name}
                  </span>
                  {state?.step === 'error' && (
                    <span className="block text-xs text-red-600 dark:text-red-400">
                      {state.message}
                    </span>
                  )}
                </span>
                <FileStatus file={f} state={state} />
                {!working && state?.step !== 'done' && (
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((prev) => prev.filter((p) => p !== f))
                    }
                    aria-label={`Remove ${f.name}`}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-6 shrink-0 items-center justify-center rounded"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <FormActions
        onCancel={onCancel}
        disabled={!ok}
        saving={working}
        label={files.length > 1 ? `Upload ${files.length} files` : 'Upload'}
      />
    </form>
  );
}

function FileStatus({ file, state }: { file: File; state?: FileState }) {
  if (file.size > MAX_BYTES) {
    return (
      <span className="shrink-0 text-xs text-red-600 dark:text-red-400">
        Over 10 MB
      </span>
    );
  }
  switch (state?.step) {
    case 'reading':
    case 'saving':
      return (
        <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
          <Loader2 className="size-3.5 animate-spin" />
          {state.step === 'reading' ? 'Reading…' : 'Saving…'}
        </span>
      );
    case 'done':
      return (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CircleCheck className="size-3.5" />
          Added
        </span>
      );
    case 'error':
      return (
        <CircleAlert className="size-4 shrink-0 text-red-600 dark:text-red-400" />
      );
    default:
      return (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {formatBytes(file.size)}
        </span>
      );
  }
}
