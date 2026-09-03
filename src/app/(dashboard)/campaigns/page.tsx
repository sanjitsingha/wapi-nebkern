'use client';

import { InfoHint } from '@/components/ui/info-hint';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Broadcast } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Radio,
  Loader2,
  Shapes,
  ChevronDown,
  Filter,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  FileText,
  Send,
  Eye,
  CircleDot,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  TEMPLATE_CATEGORY_STYLES,
  type TemplateCategory,
} from '@/components/templates/category-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { TemplatePickerDialog } from '@/components/broadcasts/template-picker-dialog';
import { OpenRowButton } from '@/components/ui/open-row-button';
import { TablePagination } from '@/components/ui/table-pagination';
import { getBroadcastStatus } from '@/lib/broadcast-status';
import {
  sortBroadcastsByDate,
  type BroadcastDateSortDirection,
} from '@/lib/broadcasts';

/**
 * Poll cadence while any broadcast is sending. Kept modest so we don't
 * beat on Supabase — the aggregate trigger in migration 003 keeps
 * counts consistent; we just need to surface the freshest snapshot.
 */
const POLL_INTERVAL_MS = 5_000;

function percent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function RateCell({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  /** Tailwind bg class for the fill, e.g. "bg-primary" */
  color: string;
}) {
  const pct = percent(value, total);
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
        {pct}%
      </span>
      <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
        <div
          className={`h-1.5 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

type BroadcastTab = 'all' | 'ongoing';

function isOngoingBroadcast(broadcast: Broadcast) {
  return broadcast.status === 'sending' || broadcast.status === 'scheduled';
}

export default function BroadcastsPage() {
  const router = useRouter();
  const canCreate = useCan('send-messages');
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [activeTab, setActiveTab] = useState<BroadcastTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const categoryOptions = ['Marketing', 'Utility', 'Authentication'] as const;
  const statusOptions = ['Completed', 'Failed'] as const;
  const [selectedCategories, setSelectedCategories] = useState<
    (typeof categoryOptions)[number][]
  >([]);
  const [selectedStatuses, setSelectedStatuses] = useState<
    (typeof statusOptions)[number][]
  >([]);
  // Per template name: Meta's current category plus the category the
  // user originally submitted (null unless we recorded it). The two
  // differ only when Meta reclassified the template on review.
  const [templateCategoryByName, setTemplateCategoryByName] = useState<
    Record<
      string,
      {
        category: TemplateCategory;
        originalCategory: TemplateCategory | null;
      }
    >
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateSortDirection, setDateSortDirection] =
    useState<BroadcastDateSortDirection>('desc');

  /** Effective (current) category — what to filter and colour-code by. */
  function getBroadcastCategory(broadcast: Broadcast) {
    return templateCategoryByName[broadcast.template_name]?.category;
  }

  /** Full category info for a broadcast's template, or undefined if the
   *  template isn't in the map yet. */
  function getBroadcastCategoryInfo(broadcast: Broadcast) {
    return templateCategoryByName[broadcast.template_name];
  }

  function getBroadcastStatusFilterValue(broadcast: Broadcast) {
    if (broadcast.status === 'sent') return 'Completed' as const;
    if (broadcast.status === 'failed') return 'Failed' as const;
    return null;
  }

  const filteredBroadcasts = useMemo(() => {
    const byTab =
      activeTab === 'ongoing'
        ? broadcasts.filter(isOngoingBroadcast)
        : broadcasts;

    const byCategory =
      selectedCategories.length > 0
        ? byTab.filter((broadcast) => {
            const category = getBroadcastCategory(broadcast);
            return category ? selectedCategories.includes(category) : false;
          })
        : byTab;

    const byStatus =
      selectedStatuses.length > 0
        ? byCategory.filter((broadcast) => {
            const statusValue = getBroadcastStatusFilterValue(broadcast);
            return statusValue ? selectedStatuses.includes(statusValue) : false;
          })
        : byCategory;

    const bySearch = !searchQuery.trim()
      ? byStatus
      : byStatus.filter((broadcast) =>
          `${broadcast.name} ${broadcast.template_name}`
            .toLowerCase()
            .includes(searchQuery.trim().toLowerCase())
        );

    return sortBroadcastsByDate(bySearch, dateSortDirection);
  }, [
    activeTab,
    broadcasts,
    searchQuery,
    selectedCategories,
    selectedStatuses,
    dateSortDirection,
  ]);

  // Page the rendered rows so a long campaign history never floods the
  // DOM at once.
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery, selectedCategories, selectedStatuses]);
  const pagedBroadcasts = filteredBroadcasts.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // Used to kick off polling only while something is actively sending.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchBroadcasts() {
    try {
      const supabase = createClient();
      const [broadcastsResult, templatesResult] = await Promise.all([
        supabase
          .from('broadcasts')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('message_templates')
          .select('name,category,original_category'),
      ]);

      if (broadcastsResult.error) throw broadcastsResult.error;
      if (templatesResult.error) throw templatesResult.error;

      const templates = templatesResult.data ?? [];
      const templateMap = templates.reduce(
        (acc, template) => ({
          ...acc,
          [template.name]: {
            category: template.category as TemplateCategory,
            originalCategory:
              (template.original_category as TemplateCategory | null) ?? null,
          },
        }),
        {} as Record<
          string,
          {
            category: TemplateCategory;
            originalCategory: TemplateCategory | null;
          }
        >
      );

      setBroadcasts(broadcastsResult.data ?? []);
      setTemplateCategoryByName(templateMap);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load broadcasts'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const anySending = useMemo(
    () => broadcasts.some((b) => b.status === 'sending'),
    [broadcasts]
  );

  useEffect(() => {
    function startPolling() {
      if (pollTimer.current) return;
      pollTimer.current = setInterval(fetchBroadcasts, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (!pollTimer.current) return;
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }

    // Pause polling while the tab is hidden — keeps Supabase cold when
    // the user is away, and ensures a fresh fetch the moment they
    // refocus so they don't see stale data on return.
    function handleVisibilityChange() {
      if (!anySending) return;
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        fetchBroadcasts();
        startPolling();
      }
    }

    if (anySending && document.visibilityState === 'visible') {
      startPolling();
    } else {
      stopPolling();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [anySending]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-destructive text-sm">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top indeterminate progress bar: only visible while a broadcast
          is mid-send. Pure CSS animation so no extra deps. */}
      {anySending && (
        <div
          role="progressbar"
          aria-label="Campaign in progress"
          className="broadcast-indeterminate bg-muted fixed inset-x-0 top-0 z-40 h-0.5 overflow-hidden"
        >
          <div className="broadcast-indeterminate-bar bg-primary h-0.5" />
          <style jsx>{`
            .broadcast-indeterminate-bar {
              width: 33%;
              transform: translateX(-100%);
              animation: broadcast-slide 1.6s cubic-bezier(0.4, 0, 0.2, 1)
                infinite;
            }
            @keyframes broadcast-slide {
              0% {
                transform: translateX(-100%);
              }
              100% {
                transform: translateX(400%);
              }
            }
          `}</style>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-foreground text-2xl font-bold">Campaigns</h1>
              <InfoHint label="Campaigns" docs="/docs/campaigns">
                A campaign sends one approved template to many contacts at
                once, then tracks what happened to each message — delivered,
                read, replied or failed.
              </InfoHint>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Send bulk messages to your contacts using approved templates.
            </p>
          </div>
          <GatedButton
            canAct={canCreate}
            gateReason="create campaigns"
            onClick={() => setTemplatePickerOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-11"
          >
            New Campaign
          </GatedButton>
        </div>

        <hr className="border-border" />

        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search campaigns or templates"
              className="max-w-xl flex-1 h-11"
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" className="h-11 gap-2 px-3.5" />
                }
              >
                <Shapes className="h-4 w-4" />
                Category
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              {/* The menu primitives are built tight — items are
                  px-1.5 py-1 — which reads as cramped on a filter list
                  with an icon and a checkmark on each row. Opened up
                  here rather than in the primitive, which 50-odd other
                  call sites share. */}
              <DropdownMenuContent className="w-52 p-1.5">
                {categoryOptions.map((category) => {
                  const Icon = TEMPLATE_CATEGORY_STYLES[category].icon;
                  return (
                    <DropdownMenuCheckboxItem
                      key={category}
                      checked={selectedCategories.includes(category)}
                      className="gap-2.5 py-2 pl-2.5"
                      onCheckedChange={() =>
                        setSelectedCategories((prev) =>
                          prev.includes(category)
                            ? prev.filter((current) => current !== category)
                            : [...prev, category]
                        )
                      }
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          TEMPLATE_CATEGORY_STYLES[category].iconColor,
                        )}
                      />
                      <span>{category}</span>
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" className="h-11 gap-2 px-3.5" />
                }
              >
                <Filter className="h-4 w-4" />
                Status
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              {/* The menu primitives are built tight — items are
                  px-1.5 py-1 — which reads as cramped on a filter list
                  with an icon and a checkmark on each row. Opened up
                  here rather than in the primitive, which 50-odd other
                  call sites share. */}
              <DropdownMenuContent className="w-52 p-1.5">
                {statusOptions.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selectedStatuses.includes(status)}
                    className="gap-2.5 py-2 pl-2.5"
                    onCheckedChange={() =>
                      setSelectedStatuses((prev) =>
                        prev.includes(status)
                          ? prev.filter((current) => current !== status)
                          : [...prev, status]
                      )
                    }
                  >
                    <Filter className="text-muted-foreground h-4 w-4" />
                    <span>{status}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              defaultValue="all"
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as BroadcastTab)}
              className="min-w-[18rem]"
            >
              <TabsList
                variant="line"
                className="gap-3 rounded-lg bg-transparent p-1"
              >
                <TabsTrigger value="all">All Campaigns</TabsTrigger>
                <TabsTrigger value="ongoing">Ongoing Campaigns</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {filteredBroadcasts.length === 0 ? (
        <div className="border-border bg-card flex h-64 flex-col items-center justify-center rounded-xl border p-8 text-center">
          <Radio className="text-muted-foreground mb-3 h-10 w-10" />
          <p className="text-foreground text-sm font-medium">
            {broadcasts.length === 0
              ? 'No campaigns yet'
              : activeTab === 'ongoing'
                ? 'No ongoing campaigns'
                : 'No campaigns found'}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {broadcasts.length === 0
              ? 'Create your first campaign to reach your contacts at scale.'
              : activeTab === 'ongoing'
                ? 'There are no campaigns currently scheduled or sending.'
                : 'Adjust your filters or create a new campaign.'}
          </p>
          <GatedButton
            canAct={canCreate}
            gateReason="create campaigns"
            onClick={() => setTemplatePickerOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 h-11"
          >
            New Campaign
          </GatedButton>
        </div>
      ) : (
        <div className="border-border bg-card overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-6 py-3.5 text-muted-foreground">
                  <button
                    type="button"
                    className="hover:text-foreground inline-flex items-center gap-1.5"
                    onClick={() =>
                      setDateSortDirection((current) =>
                        current === 'asc' ? 'desc' : 'asc'
                      )
                    }
                  >
                    <CalendarDays className="size-3.5" />
                    Date
                    {dateSortDirection === 'asc' ? (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="px-6 py-3.5 text-muted-foreground" icon={Radio}>Name</TableHead>
                <TableHead className="px-6 py-3.5 text-muted-foreground hidden md:table-cell" icon={FileText}>
                  Template
                </TableHead>
                <TableHead className="px-6 py-3.5 text-muted-foreground hidden md:table-cell" icon={Shapes}>
                  Category
                </TableHead>
                <TableHead className="px-6 py-3.5 text-muted-foreground hidden text-right sm:table-cell">
                  Recipients
                </TableHead>
                <TableHead className="px-6 py-3.5 text-muted-foreground hidden lg:table-cell" icon={Send}>
                  Delivery
                </TableHead>
                <TableHead className="px-6 py-3.5 text-muted-foreground hidden lg:table-cell" icon={Eye}>
                  Read
                </TableHead>
                <TableHead className="px-6 py-3.5 text-muted-foreground" icon={CircleDot}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedBroadcasts.map((broadcast) => {
                const status = getBroadcastStatus(broadcast.status);
                const categoryInfo = getBroadcastCategoryInfo(broadcast);
                const reclassified =
                  !!categoryInfo?.category &&
                  !!categoryInfo?.originalCategory &&
                  categoryInfo.category !== categoryInfo.originalCategory;
                return (
                  <TableRow key={broadcast.id} className="border-border hover:bg-muted/50">
                    <TableCell className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(broadcast.created_at), 'MMM d, yyyy · h:mm a')}
                    </TableCell>
                    <TableCell className="group/cell px-6 py-4 font-medium text-foreground">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate">{broadcast.name}</span>
                        <OpenRowButton
                          label="Open campaign"
                          onClick={() => router.push(`/campaigns/${broadcast.id}`)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-muted-foreground hidden md:table-cell">
                      {broadcast.template_name}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-muted-foreground hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5">
                        {categoryInfo?.category ?? '—'}
                        {reclassified && (
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
                              {categoryInfo?.originalCategory} to{' '}
                              {categoryInfo?.category}.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-muted-foreground hidden text-right tabular-nums sm:table-cell">
                      {broadcast.total_recipients}
                    </TableCell>
                    <TableCell className="px-6 py-4 hidden lg:table-cell">
                      <RateCell
                        value={broadcast.delivered_count}
                        total={broadcast.total_recipients}
                        color="bg-primary"
                      />
                    </TableCell>
                    <TableCell className="px-6 py-4 hidden lg:table-cell">
                      <RateCell
                        value={broadcast.read_count}
                        total={broadcast.total_recipients}
                        color="bg-blue-500"
                      />
                    </TableCell>
                    <TableCell
                      className={`px-6 py-4 text-sm ${
                        broadcast.status === 'failed'
                          ? 'text-red-500'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {status.label}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="px-1 pb-1">
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={filteredBroadcasts.length}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      <TemplatePickerDialog
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onConfirm={(template) => {
          setTemplatePickerOpen(false);
          router.push(`/campaigns/new?template=${encodeURIComponent(template.id)}`);
        }}
      />
    </div>
  );
}

/**
 * A bordered arrow button that opens a destination from inside a table
 * row. Hidden until its cell is hovered (or the button is focused).
 * Mirrors the Flows, Automations, Templates, and Forms tables.
 */
