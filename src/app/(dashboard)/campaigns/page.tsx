'use client';

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
  Plus,
  Loader2,
  Tag,
  ChevronDown,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  FileText,
  Send,
  Eye,
  CircleDot,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { TemplatePickerDialog } from '@/components/broadcasts/template-picker-dialog';
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

type BroadcastTab = 'all' | 'ongoing' | 'draft';

function isOngoingBroadcast(broadcast: Broadcast) {
  return broadcast.status === 'sending' || broadcast.status === 'scheduled';
}

function isDraftBroadcast(broadcast: Broadcast) {
  return broadcast.status === 'draft';
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
  const [templateCategoryByName, setTemplateCategoryByName] = useState<
    Record<string, (typeof categoryOptions)[number]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateSortDirection, setDateSortDirection] =
    useState<BroadcastDateSortDirection>('desc');

  function getBroadcastCategory(broadcast: Broadcast) {
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
        : activeTab === 'draft'
          ? broadcasts.filter(isDraftBroadcast)
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
        supabase.from('message_templates').select('name,category'),
      ]);

      if (broadcastsResult.error) throw broadcastsResult.error;
      if (templatesResult.error) throw templatesResult.error;

      const templates = templatesResult.data ?? [];
      const templateMap = templates.reduce(
        (acc, template) => ({ ...acc, [template.name]: template.category }),
        {} as Record<string, (typeof categoryOptions)[number]>
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
            <h1 className="text-foreground text-2xl font-bold">Campaigns</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Send bulk messages to your contacts using approved templates.
            </p>
          </div>
          <GatedButton
            canAct={canCreate}
            gateReason="create campaigns"
            onClick={() => setTemplatePickerOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 gap-2"
          >
            <FaWhatsapp className="h-4 w-4" />
            <Plus className="h-3.5 w-3.5" />
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
                render={<Button variant="outline" className="h-11 gap-2" />}
              >
                <Tag className="h-4 w-4" />
                Category
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                {categoryOptions.map((category) => (
                  <DropdownMenuCheckboxItem
                    key={category}
                    checked={selectedCategories.includes(category)}
                    className="gap-2"
                    onCheckedChange={() =>
                      setSelectedCategories((prev) =>
                        prev.includes(category)
                          ? prev.filter((current) => current !== category)
                          : [...prev, category]
                      )
                    }
                  >
                    <Tag className="text-muted-foreground h-4 w-4" />
                    <span>{category}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" className="h-11 gap-2" />}
              >
                <Filter className="h-4 w-4" />
                Status
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                {statusOptions.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selectedStatuses.includes(status)}
                    className="gap-2"
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
                <TabsTrigger value="draft">Draft Campaigns</TabsTrigger>
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
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 h-11 gap-2"
          >
            <FaWhatsapp className="h-4 w-4" />
            <Plus className="h-3.5 w-3.5" />
            New Campaign
          </GatedButton>
        </div>
      ) : (
        <div className="border-border bg-card overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-muted-foreground">
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
                <TableHead className="text-muted-foreground" icon={Radio}>Name</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell" icon={FileText}>
                  Template
                </TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell" icon={Tag}>
                  Category
                </TableHead>
                <TableHead className="text-muted-foreground hidden text-right sm:table-cell">
                  Recipients
                </TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell" icon={Send}>
                  Delivery
                </TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell" icon={Eye}>
                  Read
                </TableHead>
                <TableHead className="text-muted-foreground" icon={CircleDot}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBroadcasts.map((broadcast) => {
                const status = getBroadcastStatus(broadcast.status);
                return (
                  <TableRow
                    key={broadcast.id}
                    className="border-border hover:bg-muted/50 cursor-pointer"
                    onClick={() => router.push(`/campaigns/${broadcast.id}`)}
                  >
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(broadcast.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-foreground font-medium">
                      {broadcast.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {broadcast.template_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      <span className="border-border bg-muted text-muted-foreground inline-flex rounded-full border px-2 py-0.5 text-xs">
                        {getBroadcastCategory(broadcast) ?? 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-right tabular-nums sm:table-cell">
                      {broadcast.total_recipients}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <RateCell
                        value={broadcast.delivered_count}
                        total={broadcast.total_recipients}
                        color="bg-primary"
                      />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <RateCell
                        value={broadcast.read_count}
                        total={broadcast.total_recipients}
                        color="bg-blue-500"
                      />
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${status.classes}`}
                      >
                        {status.pulse && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yellow-400" />
                          </span>
                        )}
                        {status.label}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
