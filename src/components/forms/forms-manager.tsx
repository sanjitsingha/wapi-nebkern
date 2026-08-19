'use client';

import { InfoHint } from '@/components/ui/info-hint';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Pencil,
  Search,
  Send,
  MoreVertical,
  ClipboardList,
  CircleDot,
  ListChecks,
  CalendarDays,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { formStatusConfig } from '@/lib/whatsapp-form-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { WhatsAppForm, WhatsAppFormStatus } from '@/types';

/**
 * List + lifecycle actions for WhatsApp Forms (native WhatsApp Flows —
 * see src/lib/whatsapp/forms.ts for the naming note). Mirrors
 * src/components/settings/template-manager.tsx's shape, trimmed down:
 * no Meta sync (a form's status changes only through actions taken
 * here, so there's nothing external to reconcile against).
 */
/**
 * What the destructive action means for a form in a given state.
 *
 * Meta lets a published Flow be deprecated but never deleted, so "get
 * rid of this" lands differently at each point in a form's life. A form
 * that is already DEPRECATED is finished on Meta's side, and the only
 * thing left is the local row — deleting that is what actually takes it
 * off this list. Before, DEPRECATED matched none of the cases and the
 * actions menu rendered empty, which left the form stuck on the page
 * with no way to act on it.
 */
function destructiveAction(status: WhatsAppFormStatus) {
  if (status === 'DRAFT') {
    return {
      label: 'Delete',
      title: 'Delete this form?',
      describe: (name: string) =>
        `"${name}" will be removed from Meta and from Instant. This can't be undone.`,
    };
  }
  if (status === 'DEPRECATED') {
    return {
      label: 'Delete',
      title: 'Remove this form?',
      describe: (name: string) =>
        `"${name}" is already deprecated on Meta and stays that way — this only takes it off ` +
        `your list. Past responses keep their answers, but stop linking back to the form. ` +
        `This can't be undone.`,
    };
  }
  return {
    label: 'Deprecate',
    title: 'Deprecate this form?',
    describe: (name: string) =>
      `"${name}" can no longer be sent, but past responses stay intact. This can't be undone.`,
  };
}

export function FormsManager() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<WhatsAppForm[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Two-step delete, same reasoning as templates: the action also
  // deletes-or-deprecates the flow on Meta's side, so a misclick
  // shouldn't be free.
  const [formToDelete, setFormToDelete] = useState<WhatsAppForm | null>(null);

  useEffect(() => {
    fetchForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchForms() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_forms')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setForms((data as WhatsAppForm[]) ?? []);
    } catch (err) {
      console.error('Failed to fetch forms:', err);
      toast.error('Failed to load forms');
    } finally {
      setLoading(false);
    }
  }

  const filteredForms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((f) => f.name.toLowerCase().includes(q));
  }, [forms, searchQuery]);

  async function handlePublish(form: WhatsAppForm) {
    setPublishingId(form.id);
    try {
      const res = await fetch(`/api/whatsapp/forms/${form.id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Publish failed (HTTP ${res.status})`);
      setForms((prev) => prev.map((f) => (f.id === form.id ? data.form : f)));
      toast.success(
        data.form.status === 'PUBLISHED'
          ? 'Form published — it can now be sent from the inbox.'
          : `Form status: ${data.form.status}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish form');
    } finally {
      setPublishingId(null);
    }
  }

  async function handleDelete() {
    if (!formToDelete) return;
    setDeletingId(formToDelete.id);
    try {
      const res = await fetch(`/api/whatsapp/forms/${formToDelete.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Delete failed (HTTP ${res.status})`);
      // DRAFT and DEPRECATED both leave the list — the row is gone
      // server-side. Everything else survives as a deprecated row.
      const removed =
        formToDelete.status === 'DRAFT' || formToDelete.status === 'DEPRECATED';
      if (removed) {
        setForms((prev) => prev.filter((f) => f.id !== formToDelete.id));
      } else {
        setForms((prev) =>
          prev.map((f) => (f.id === formToDelete.id ? { ...f, status: 'DEPRECATED' } : f)),
        );
      }
      toast.success(removed ? 'Form deleted' : 'Form deprecated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete form');
    } finally {
      setDeletingId(null);
      setFormToDelete(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary size-6 animate-spin" />
      </div>
    );
  }

  return (
    <section className="animate-in fade-in-50 space-y-4 duration-200">
      <div className="border-border flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-2xl font-bold tracking-tight">Forms</h1>
            {/* No /docs page for Forms yet, so the hint stands alone —
                InfoHint drops the link when `docs` is omitted. */}
            <InfoHint label="Forms">
              A structured questionnaire that opens inside WhatsApp. Answers
              come back onto the contact record, so you collect details
              without a back-and-forth conversation.
            </InfoHint>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Structured forms that open inside WhatsApp — build one, publish it, then send it
            from any conversation.
          </p>
        </div>
        <Button onClick={() => router.push('/forms/new')} className="h-11">
          <Plus className="size-4" />
          New Form
        </Button>
      </div>

      {forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="text-muted-foreground/50 mb-3 size-8" />
            <p className="text-muted-foreground text-sm">No forms yet.</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Create a form to capture leads or feedback without the customer leaving WhatsApp.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative w-full sm:max-w-sm">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search forms"
              className="h-11 pl-9"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-muted-foreground" icon={ClipboardList}>
                    Name
                  </TableHead>
                  <TableHead className="text-muted-foreground" icon={CircleDot}>
                    Status
                  </TableHead>
                  <TableHead
                    className="hidden text-muted-foreground md:table-cell"
                    icon={ListChecks}
                  >
                    Fields
                  </TableHead>
                  <TableHead
                    className="hidden text-muted-foreground lg:table-cell"
                    icon={CalendarDays}
                  >
                    Created
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredForms.map((form) => {
                  const status = formStatusConfig[form.status];
                  const hasErrors = form.validation_errors?.length > 0;
                  const canEdit = form.status === 'DRAFT';
                  const canPublish = form.status === 'DRAFT';
                  const canSend = form.status === 'PUBLISHED';
                  return (
                    <TableRow
                      key={form.id}
                      className="border-border hover:bg-muted/50"
                    >
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{form.name}</span>
                          {hasErrors && (
                            <span title="Meta reported validation issues on this form">
                              <AlertCircle className="size-3.5 shrink-0 text-red-400" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`border text-xs ${status.classes}`}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {form.fields?.length ?? 0}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                        {new Date(form.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground hover:bg-muted size-8"
                              />
                            }
                            aria-label="Form actions"
                          >
                            <MoreVertical className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {canEdit && (
                              <DropdownMenuItem onClick={() => router.push(`/forms/${form.id}/edit`)}>
                                <Pencil className="size-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canPublish && (
                              <DropdownMenuItem
                                disabled={publishingId === form.id}
                                onClick={() => handlePublish(form)}
                              >
                                {publishingId === form.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Send className="size-4" />
                                )}
                                Publish
                              </DropdownMenuItem>
                            )}
                            {canSend && (
                              <DropdownMenuItem
                                onClick={() => router.push(`/inbox?sendForm=${form.id}`)}
                              >
                                <Send className="size-4" />
                                Send from inbox
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => setFormToDelete(form)}
                              className="text-red-500 focus:text-red-500"
                            >
                              <Trash2 className="size-4" />
                              {destructiveAction(form.status).label}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={!!formToDelete} onOpenChange={(open) => !open && setFormToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formToDelete
                ? destructiveAction(formToDelete.status).title
                : 'Delete this form?'}
            </DialogTitle>
            <DialogDescription>
              {formToDelete
                ? destructiveAction(formToDelete.status).describe(
                    formToDelete.name,
                  )
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletingId === formToDelete?.id}
              onClick={handleDelete}
            >
              {deletingId === formToDelete?.id && <Loader2 className="size-4 animate-spin" />}
              {formToDelete ? destructiveAction(formToDelete.status).label : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
