'use client';

import { InfoHint } from '@/components/ui/info-hint';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Loader2,
  RefreshCw,
  AlertCircle,
  Copy,
  Search,
  Filter,
  ChevronDown,
  FileText,
  Shapes,
  CircleDot,
  Languages,
  User,
  CalendarDays,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { TEMPLATE_CATEGORY_STYLES } from '@/components/templates/category-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              Templates
            </h1>
            <InfoHint label="Templates" docs="/docs/templates">
              Pre-approved message formats. Meta requires one for any message
              you start a conversation with, so campaigns and automated
              follow-ups can only send templates that have passed review.
            </InfoHint>
          </div>
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
                  <Shapes className="size-4" />
                  Category
                  {categoryFilter.length > 0 && (
                    <span className="bg-primary/15 text-primary ml-0.5 rounded-full px-1.5 text-xs font-medium">
                      {categoryFilter.length}
                    </span>
                  )}
                  <ChevronDown className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {CATEGORIES.map((c) => {
                    const Icon = TEMPLATE_CATEGORY_STYLES[c].icon;
                    return (
                      <DropdownMenuCheckboxItem
                        key={c}
                        checked={categoryFilter.includes(c)}
                        onCheckedChange={() => toggleCategoryFilter(c)}
                        className="gap-2"
                      >
                        <Icon
                          className={`size-4 ${TEMPLATE_CATEGORY_STYLES[c].iconColor}`}
                        />
                        <span>{c}</span>
                      </DropdownMenuCheckboxItem>
                    );
                  })}
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
                  <TableHead className="px-6 py-3.5 text-muted-foreground" icon={CalendarDays}>Created</TableHead>
                  <TableHead className="px-6 py-3.5 text-muted-foreground" icon={FileText}>Name</TableHead>
                  <TableHead className="px-6 py-3.5 text-muted-foreground" icon={Shapes}>Category</TableHead>
                  <TableHead className="px-6 py-3.5 text-muted-foreground" icon={CircleDot}>Status</TableHead>
                  <TableHead className="px-6 py-3.5 text-muted-foreground hidden md:table-cell" icon={Languages}>
                    Language
                  </TableHead>
                  <TableHead className="px-6 py-3.5 text-muted-foreground hidden lg:table-cell" icon={User}>
                    Created by
                  </TableHead>
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
                    return (
                      <TableRow
                        key={template.id}
                        className="border-border"
                      >
                        <TableCell className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                          {format(
                            new Date(template.created_at),
                            'MMM d, yyyy · h:mm a',
                          )}
                        </TableCell>
                        <TableCell className="group/cell px-6 py-4 font-medium text-foreground">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate">{template.name}</span>
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
                            <OpenButton
                              label="Open template"
                              onClick={() =>
                                router.push(`/templates/${template.id}/edit`)
                              }
                            />
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            {template.category}
                            {template.original_category &&
                              template.original_category !==
                                template.category && (
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <span
                                        className="cursor-help"
                                        aria-label="Category changed by Meta"
                                      >
                                        <Info className="size-3.5 shrink-0 text-amber-500" />
                                      </span>
                                    }
                                  />
                                  <TooltipContent>
                                    Meta reclassified this template from{' '}
                                    {template.original_category} to{' '}
                                    {template.category}.
                                  </TooltipContent>
                                </Tooltip>
                              )}
                          </span>
                        </TableCell>
                        <TableCell
                          className={`px-6 py-4 text-sm ${
                            statusKey === 'REJECTED'
                              ? 'text-red-500'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {status.label}
                        </TableCell>
                        <TableCell className="hidden px-6 py-4 text-sm uppercase text-muted-foreground md:table-cell">
                          {template.language || '—'}
                        </TableCell>
                        <TableCell className="hidden px-6 py-4 text-sm text-muted-foreground lg:table-cell">
                          {createdByLabel}
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
    </section>
  );
}

/**
 * A bordered arrow button that opens a destination from inside a table
 * row. Hidden until its cell is hovered (or the button is focused).
 * Mirrors the Flows and Automations tables.
 */
function OpenButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground opacity-0 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:opacity-100 group-hover/cell:opacity-100"
    >
      <ArrowUpRight className="h-4 w-4" />
    </button>
  );
}
