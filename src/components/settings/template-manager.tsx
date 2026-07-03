'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  AlertCircle,
  Pencil,
  RotateCcw,
  Copy,
  Search,
  Filter,
  ChevronDown,
  MoreVertical,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { softBadge } from '@/lib/badge-colors';
import { useAuth } from '@/hooks/use-auth';
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
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { MessageTemplate, MessageTemplateStatus } from '@/types';
import { templateStatusConfig } from '@/lib/template-status';

const CATEGORIES = ['Marketing', 'Utility', 'Authentication'] as const;

// Statuses offered in the table's status filter. Fixed (not derived
// from the current rows) so common buckets like Rejected are always
// selectable even when none are present yet.
const STATUS_FILTER_OPTIONS: MessageTemplateStatus[] = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'PAUSED',
];

const categoryColors: Record<string, string> = {
  Marketing: softBadge.purple,
  Utility: softBadge.blue,
  Authentication: softBadge.amber,
};

// localStorage key for the "Last sync" hint shown beside the Sync
// button. Per-device — a coarse "when did I last pull from Meta".
const LAST_SYNC_KEY = 'wacrm.templates-last-sync';

function formatSyncTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TemplateManager() {
  const supabase = createClient();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MessageTemplate['status'][]>(
    [],
  );
  const [categoryFilter, setCategoryFilter] = useState<
    MessageTemplate['category'][]
  >([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Template selected for the confirm-delete dialog. The destructive
  // action goes through this two-step so a slip on the trash icon
  // doesn't take the template off Meta as well as locally.
  const [templateToDelete, setTemplateToDelete] =
    useState<MessageTemplate | null>(null);

  useEffect(() => {
    setLastSyncedAt(localStorage.getItem(LAST_SYNC_KEY));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchTemplates(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function fetchTemplates(userId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((t) => {
      const matchesStatus =
        statusFilter.length === 0 ||
        statusFilter.includes(t.status || 'DRAFT');
      const matchesCategory =
        categoryFilter.length === 0 || categoryFilter.includes(t.category);
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.body_text.toLowerCase().includes(q);
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [templates, searchQuery, statusFilter, categoryFilter]);

  function toggleStatusFilter(status: MessageTemplate['status']) {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  }

  function toggleCategoryFilter(category: MessageTemplate['category']) {
    setCategoryFilter((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  }

  async function copyTemplateName(name: string) {
    try {
      await navigator.clipboard.writeText(name);
      toast.success('Template name copied');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  const createdByLabel = profile?.full_name || profile?.email || '—';

  async function handleSyncFromMeta() {
    if (!user) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/whatsapp/templates/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Sync failed (HTTP ${res.status})`);
      }
      toast.success(
        `Synced ${data.total} template${data.total === 1 ? '' : 's'} from Meta` +
          (data.inserted || data.updated
            ? ` (${data.inserted} new, ${data.updated} updated)`
            : ''),
      );
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const preview = data.errors.slice(0, 3).map(
          (e: { name: string; language: string; message: string }) =>
            `${e.name} (${e.language})`,
        );
        const suffix =
          data.errors.length > 3 ? `, +${data.errors.length - 3} more` : '';
        toast.error(`Failed to sync: ${preview.join(', ')}${suffix}`);
      }
      if (data.truncated) {
        toast.error(
          'Synced the first 2000 templates only — your account has more. Sync again to continue, or contact support if this persists.',
          { duration: 10000 },
        );
      }
      const syncedAt = new Date().toISOString();
      setLastSyncedAt(syncedAt);
      localStorage.setItem(LAST_SYNC_KEY, syncedAt);
      await fetchTemplates(user.id);
    } catch (err) {
      console.error('Template sync error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to sync templates');
    } finally {
      setSyncing(false);
    }
  }

  async function confirmDelete() {
    const target = templateToDelete;
    if (!target || deletingId) return;
    setDeletingId(target.id);
    try {
      const res = await fetch(`/api/whatsapp/templates/${target.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Delete failed (HTTP ${res.status})`);
      }
      toast.success('Template deleted');
      setTemplates((prev) => prev.filter((t) => t.id !== target.id));
      setTemplateToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className="animate-in fade-in-50 space-y-4 duration-200">
      <div className="border-border flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Templates
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage message templates and submit them to Meta for approval.
          </p>
        </div>
        <Button onClick={() => router.push('/templates/new')} className="h-11">
          <Plus className="size-4" />
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground text-sm">No templates yet.</p>
            <p className="text-muted-foreground text-xs mt-1">
              Create your first message template to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search + filters */}
          <div className="my-3 flex flex-col gap-2 py-1 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates"
                className="h-11 pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" className="h-11 gap-2" />}
                >
                  <Filter className="size-4" />
                  Category
                  {categoryFilter.length > 0 && (
                    <span className="bg-primary/15 text-primary ml-0.5 rounded-full px-1.5 text-xs font-medium">
                      {categoryFilter.length}
                    </span>
                  )}
                  <ChevronDown className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {CATEGORIES.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c}
                      checked={categoryFilter.includes(c)}
                      onCheckedChange={() => toggleCategoryFilter(c)}
                    >
                      {c}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {categoryFilter.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setCategoryFilter([])}>
                        Clear categories
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" className="h-11 gap-2" />}
                >
                  <Filter className="size-4" />
                  Status
                  {statusFilter.length > 0 && (
                    <span className="bg-primary/15 text-primary ml-0.5 rounded-full px-1.5 text-xs font-medium">
                      {statusFilter.length}
                    </span>
                  )}
                  <ChevronDown className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {STATUS_FILTER_OPTIONS.map((s) => (
                    <DropdownMenuCheckboxItem
                      key={s}
                      checked={statusFilter.includes(s)}
                      onCheckedChange={() => toggleStatusFilter(s)}
                    >
                      {templateStatusConfig[s].label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {statusFilter.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setStatusFilter([])}>
                        Clear statuses
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2 sm:ml-auto">
              {lastSyncedAt && (
                <span className="text-muted-foreground whitespace-nowrap text-xs">
                  Last sync: {formatSyncTime(lastSyncedAt)}
                </span>
              )}
              <Button
                variant="outline"
                onClick={handleSyncFromMeta}
                disabled={syncing}
                title="Pull approved templates from your Meta WhatsApp Business Account"
                className="h-11"
              >
                <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync from Meta'}
              </Button>
            </div>
          </div>

          <div className="border-border bg-card overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Category</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground hidden md:table-cell">
                    Language
                  </TableHead>
                  <TableHead className="text-muted-foreground hidden lg:table-cell">
                    Created by
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.length === 0 ? (
                  <TableRow className="border-border hover:bg-transparent">
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground py-10 text-center text-sm"
                    >
                      No templates match your search or filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTemplates.map((template) => {
                    const statusKey = template.status || 'DRAFT';
                    const status = templateStatusConfig[statusKey];
                    const error =
                      template.rejection_reason || template.submission_error;
                    const canEdit = statusKey === 'APPROVED';
                    const canResubmit =
                      statusKey === 'REJECTED' || statusKey === 'PAUSED';
                    const canEditDraft = statusKey === 'DRAFT';
                    return (
                      <TableRow
                        key={template.id}
                        className="border-border [&>td]:py-4"
                      >
                        <TableCell className="font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span>{template.name}</span>
                            {error && (
                              <span
                                title={error}
                                aria-label={`Review issue: ${error}`}
                              >
                                <AlertCircle className="size-3.5 shrink-0 text-red-400" />
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyTemplateName(template.name)}
                              title="Copy template name"
                              aria-label="Copy template name"
                              className="text-muted-foreground hover:text-primary hover:bg-primary/10 size-7"
                            >
                              <Copy className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs border ${categoryColors[template.category] || ''}`}
                          >
                            {template.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge className={`text-xs border ${status.classes}`}>
                              {status.label}
                            </Badge>
                            {template.quality_score && (
                              <span
                                className={`text-[10px] uppercase font-medium ${
                                  template.quality_score === 'GREEN'
                                    ? 'text-emerald-400'
                                    : template.quality_score === 'YELLOW'
                                      ? 'text-yellow-400'
                                      : 'text-red-400'
                                }`}
                                title="Meta quality score"
                              >
                                {template.quality_score}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-xs uppercase text-muted-foreground md:table-cell">
                          {template.language || '—'}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                          {createdByLabel}
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
                              aria-label="Template actions"
                            >
                              <MoreVertical className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {canEdit && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(`/templates/${template.id}/edit`)
                                  }
                                >
                                  <Pencil className="size-4" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {canResubmit && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(`/templates/${template.id}/edit`)
                                  }
                                >
                                  <RotateCcw className="size-4" />
                                  Resubmit
                                </DropdownMenuItem>
                              )}
                              {canEditDraft && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(`/templates/${template.id}/edit`)
                                  }
                                >
                                  <Pencil className="size-4" />
                                  Edit draft
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => copyTemplateName(template.name)}
                              >
                                <Copy className="size-4" />
                                Copy name
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={deletingId === template.id}
                                onClick={() => setTemplateToDelete(template)}
                              >
                                <Trash2 className="size-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Confirm-delete dialog. Surfacing the meta_template_id case
          separately so users understand a real Meta delete is happening,
          not just a local cleanup. */}
      <Dialog
        open={templateToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setTemplateToDelete(null);
        }}
      >
        <DialogContent className="bg-popover border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">Delete template?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {templateToDelete?.meta_template_id
                ? `"${templateToDelete?.name}" will be deleted from Meta and from wacrm. Active broadcasts using this template will start failing on their next send. This can't be undone.`
                : `"${templateToDelete?.name}" will be deleted from wacrm. It was never submitted to Meta, so no remote cleanup is needed.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setTemplateToDelete(null)}
              disabled={deletingId !== null}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deletingId !== null}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingId !== null ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
