'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Pencil, RefreshCw, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface DocSummary {
  id: string;
  title: string;
  updated_at: string;
}

/** Editor target: 'new' when creating, a doc id when editing, null when closed. */
type EditTarget = 'new' | string | null;

export function AiKnowledgeCard({
  accountId,
  canEdit,
  hasEmbeddingsKey,
}: {
  accountId: string | null;
  canEdit: boolean;
  hasEmbeddingsKey: boolean;
}) {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const loadedAccountIdRef = useRef<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/knowledge');
      const data = await res.json();
      if (res.ok) setDocs(data.documents ?? []);
      else toast.error(data.error ?? 'Failed to load knowledge base');
    } catch {
      toast.error('Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accountId || loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    void fetchDocs();
  }, [accountId, fetchDocs]);

  const openNew = () => {
    setEditing('new');
    setTitle('');
    setContent('');
  };

  const openEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/knowledge/${id}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to open document');
        return;
      }
      setEditing(id);
      setTitle(data.title ?? '');
      setContent(data.content ?? '');
    } catch {
      toast.error('Failed to open document');
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setTitle('');
    setContent('');
  };

  const save = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required.');
      return;
    }
    setSaving(true);
    try {
      const isNew = editing === 'new';
      const res = await fetch(
        isNew ? '/api/ai/knowledge' : `/api/ai/knowledge/${editing}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), content: content.trim() }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        // A 200 with `warning` means saved but indexing degraded.
        if (data.warning) toast.warning(data.warning);
        else toast.success(isNew ? 'Document added.' : 'Document updated.');
        cancelEdit();
        await fetchDocs();
      } else {
        toast.error(data.error ?? 'Failed to save.');
      }
    } catch {
      toast.error('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      const res = await fetch(`/api/ai/knowledge/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Document removed.');
        setDocs((d) => d.filter((x) => x.id !== id));
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'Failed to remove.');
      }
    } catch {
      toast.error('Failed to remove.');
    }
  };

  const reindex = async () => {
    setReindexing(true);
    try {
      const res = await fetch('/api/ai/knowledge/reindex', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Reindexed ${data.reindexed} document(s).`);
      } else {
        toast.error(data.error ?? 'Reindex failed.');
      }
    } catch {
      toast.error('Reindex failed.');
    } finally {
      setReindexing(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <BookOpen className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Knowledge base</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Add FAQs, policies, or product details. The assistant retrieves the
            relevant pieces when drafting and auto-replying, so it can answer
            instead of handing off.{' '}
            {hasEmbeddingsKey
              ? 'Semantic search is on (embeddings key set).'
              : 'Using keyword search — add an embeddings key above for semantic search.'}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {loading ? (
          <div className="flex items-center py-4 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {docs.length === 0 && editing === null && (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                No documents yet. Add your first FAQ or policy below.
              </p>
            )}

            {docs.length > 0 && (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {docs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-2 bg-background px-3.5 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                      <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{doc.title}</span>
                    </span>
                    {canEdit && (
                      <span className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => void openEdit(doc.id)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => void remove(doc.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {editing !== null ? (
              <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="kb-title">Title</Label>
                  <Input
                    id="kb-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Returns & refunds policy"
                    disabled={saving}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kb-content">Content</Label>
                  <Textarea
                    id="kb-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste the FAQ answer, policy text, or product details…"
                    rows={8}
                    disabled={saving}
                    className="resize-none leading-relaxed"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={save} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save document
                  </Button>
                </div>
              </div>
            ) : (
              canEdit && (
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={openNew}>
                    <Plus className="mr-2 h-4 w-4" /> Add document
                  </Button>
                  {hasEmbeddingsKey && docs.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={reindex}
                      disabled={reindexing}
                      title="Re-embed all documents (e.g. after adding an embeddings key)"
                    >
                      {reindexing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Reindex
                    </Button>
                  )}
                </div>
              )
            )}
          </>
        )}
      </div>
    </section>
  );
}
