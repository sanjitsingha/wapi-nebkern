'use client';

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
import type { WhatsAppForm } from '@/types';

/**
 * List + lifecycle actions for WhatsApp Forms (native WhatsApp Flows —
 * see src/lib/whatsapp/forms.ts for the naming note). Mirrors
 * src/components/settings/template-manager.tsx's shape, trimmed down:
 * no Meta sync (a form's status changes only through actions taken
 * here, so there's nothing external to reconcile against).
 */
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
      if (formToDelete.status === 'DRAFT') {
        setForms((prev) => prev.filter((f) => f.id !== formToDelete.id));
      } else {
        setForms((prev) =>
          prev.map((f) => (f.id === formToDelete.id ? { ...f, status: 'DEPRECATED' } : f)),
        );
      }
      toast.success(formToDelete.status === 'DRAFT' ? 'Form deleted' : 'Form deprecated');
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
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Forms</h1>
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

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Fields</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableRow key={form.id} className="border-border [&>td]:py-4">
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
                            {form.status !== 'DEPRECATED' && (
                              <DropdownMenuItem
                                onClick={() => setFormToDelete(form)}
                                className="text-red-500 focus:text-red-500"
                              >
                                <Trash2 className="size-4" />
                                {form.status === 'DRAFT' ? 'Delete' : 'Deprecate'}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <Dialog open={!!formToDelete} onOpenChange={(open) => !open && setFormToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formToDelete?.status === 'DRAFT' ? 'Delete this form?' : 'Deprecate this form?'}
            </DialogTitle>
            <DialogDescription>
              {formToDelete?.status === 'DRAFT'
                ? `"${formToDelete?.name}" will be removed from Meta and from wacrm. This can't be undone.`
                : `"${formToDelete?.name}" can no longer be sent, but past responses stay intact. This can't be undone.`}
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
              {formToDelete?.status === 'DRAFT' ? 'Delete' : 'Deprecate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
