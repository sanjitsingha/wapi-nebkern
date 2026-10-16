"use client";

import {
  Fragment,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useTags, useTeamMembers } from "@/hooks/reference-data";
import { useConnectedChannels } from "@/hooks/use-connected-channels";
import { cn } from "@/lib/utils";
import type {
  Conversation,
  ConversationChannel,
  ConversationStatus,
  Tag,
} from "@/types";
import {
  Bot,
  Check,
  Search,
} from "lucide-react";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { Input } from "@/components/ui/input";
import { avatarColor } from "@/lib/avatar-color";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InboxFilterMenu } from "@/components/inbox/inbox-filter-menu";
import {
  EMPTY_FILTERS,
  activeCount,
  matchesFilters,
  type InboxFilters,
} from "@/lib/inbox/filters";
import {
  WhatsAppLogo,
  MessengerLogo,
  InstagramLogo,
} from "@/components/inbox/channel-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FlowOption {
  id: string;
  name: string;
}

// Contact with embedded tag ids from the join
interface ContactWithTags {
  id: string;
  name?: string;
  phone?: string | null;
  instagram_id?: string | null;
  messenger_id?: string | null;
  avatar_url?: string;
  is_spam?: boolean;
  contact_tags?: { tag_id: string }[];
  [key: string]: unknown;
}

// Conversation with the enriched contact shape
interface ConversationWithTags extends Omit<Conversation, "contact"> {
  contact?: ContactWithTags;
}

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  resyncToken?: number;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "bg-primary",
  pending: "bg-amber-500",
  closed: "bg-muted-foreground",
};

type ChannelFilter = ConversationChannel | "all";

// Channel tabs sit above the search box — the coarsest cut through the
// inbox, so they read as tabs rather than joining the chip row below.
// Rows with no `channel` value are pre-migration-044 WhatsApp threads.
// Each carries its full-colour brand mark; "All" has none (it's not a
// platform, and it isn't shown while WhatsApp is the only live channel).
const CHANNEL_OPTIONS: {
  label: string;
  value: ChannelFilter;
  Logo?: React.FC<{ className?: string }>;
}[] = [
  { label: "All", value: "all" },
  { label: "WhatsApp", value: "whatsapp", Logo: WhatsAppLogo },
  // Instagram before Messenger — the order they render in the channel bar.
  { label: "Instagram", value: "instagram", Logo: InstagramLogo },
  { label: "Messenger", value: "messenger", Logo: MessengerLogo },
];

// Which channels are selectable is no longer a constant: Messenger and
// Instagram become real tabs the moment this account connects them in
// Settings, and drop back to greyed-out logos if they are disconnected.
// WhatsApp is always a tab — it is the product's core channel, and its
// threads exist whether or not a number is currently attached.
//
// A channel nobody has connected stays visible but unclickable rather
// than disappearing: the point is to show the inbox covers it, and a tab
// that filters to an empty list is a worse answer than a tooltip.
function splitChannels(connected: { messenger: boolean; instagram: boolean }) {
  const live = new Set<ChannelFilter>(["whatsapp"]);
  if (connected.messenger) live.add("messenger");
  if (connected.instagram) live.add("instagram");

  const platforms = CHANNEL_OPTIONS.filter((o) => o.value !== "all");
  const tabs = platforms.filter((o) => live.has(o.value));

  return {
    live,
    // "All" only earns a tab once there is more than one channel to mix;
    // with a single channel it would be a synonym for the tab beside it.
    tabs: tabs.length > 1 ? [CHANNEL_OPTIONS[0], ...tabs] : tabs,
    comingSoon: platforms.filter((o) => !live.has(o.value)),
  };
}

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  // Which tabs exist depends on what this account has connected, which
  // arrives a beat after mount — so the bar starts as WhatsApp alone and
  // widens once the answer lands.
  const { channels: connectedChannels } = useConnectedChannels();
  const { live: liveChannels, tabs: channelTabs, comingSoon: comingSoonChannels } =
    useMemo(() => splitChannels(connectedChannels), [connectedChannels]);

  // Only an explicit pick is stored; the channel actually in force is
  // derived. That keeps two awkward cases honest without an effect:
  // before the connected-channel answer arrives there is nothing to
  // reconcile, and a channel disconnected mid-session simply stops being
  // selectable — the filter falls back to the first tab instead of
  // stranding the user on an empty list with no lit tab.
  const [channelChoice, setChannelChoice] = useState<ChannelFilter | null>(null);
  const channel: ChannelFilter =
    channelChoice &&
    (channelChoice === "all"
      ? channelTabs.some((t) => t.value === "all")
      : liveChannels.has(channelChoice))
      ? channelChoice
      : (channelTabs[0]?.value ?? "all");
  // Every filter in one place — the filter button's menu (labels, status,
  // read, awaiting, assignee, dates, reply window), matched ALL or ANY.
  // See lib/inbox/filters.ts.
  const [filters, setFilters] = useState<InboxFilters>(EMPTY_FILTERS);
  // "Today", "Last 7 days" and the 24-hour window move with the clock;
  // ticking once a minute keeps them honest without re-filtering on
  // every render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Shared, cached, and fetched once per account rather than once per
  // mount of this list — see src/hooks/reference-data.ts. Both were
  // their own useEffect + useState here, re-running every time the
  // inbox opened, for lists that change about once a week.
  const { data: availableTags = [] } = useTags();
  const { data: profiles = [] } = useTeamMembers();

  // user_id → { name, avatar }, for the "assigned to <person>" chip on
  // each row. conversation.assigned_agent_id holds the teammate's user_id
  // (the same value the assignee filter matches on).
  const memberById = useMemo(() => {
    const m = new Map<string, { name: string; avatarUrl: string | null }>();
    for (const p of profiles) {
      if (p.user_id) {
        m.set(p.user_id, {
          name: p.full_name || p.email || "Teammate",
          avatarUrl: p.avatar_url ?? null,
        });
      }
    }
    return m;
  }, [profiles]);

  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  // Active flows (bots) — for the per-row assign menu.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/flows")
      .then((r) => (r.ok ? r.json() : { flows: [] }))
      .then((data: { flows?: { id: string; name: string; status: string }[] }) => {
        if (cancelled) return;
        setFlows(
          (data.flows ?? [])
            .filter((f) => f.status === "active")
            .map((f) => ({ id: f.id, name: f.name })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // tag_id → Tag, so rows can resolve a contact's tags to name + color.
  const tagMap = useMemo(() => {
    const m = new Map<string, Tag>();
    availableTags.forEach((t) => m.set(t.id, t));
    return m;
  }, [availableTags]);

  // Assign / unassign a bot (flow) straight from a conversation row.
  // Routes through the same endpoint as the thread's Assign dropdown,
  // then patches the conversation in the parent's list state.
  const assignFlow = useCallback(
    async (conversationId: string, flowId: string | null) => {
      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/assign`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              flowId ? { type: "flow", flowId } : { type: "none" },
            ),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          toast.error(data?.error ?? "Failed to update assignment");
          return;
        }
        onConversationsLoadedRef.current(
          (conversations as Conversation[]).map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  assigned_flow_id: data.assigned_flow_id ?? null,
                  assigned_agent_id: data.assigned_agent_id ?? undefined,
                }
              : c,
          ),
        );
        toast.success(flowId ? "Assigned to bot" : "Bot unassigned");
      } catch {
        toast.error("Failed to update assignment");
      }
    },
    [conversations],
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      // Tags used to be fetched alongside this, on every mount. They now
      // come from the shared cache (useTags above), so this is just the
      // conversations read.
      const convsRes = await (async () =>
        supabase
          .from("conversations")
          // Named contact columns, not `contacts(*)`. The row renders
          // six fields; `*` shipped every column of the contacts table —
          // including custom-field payloads and notes — for every
          // conversation, on every inbox mount. contact_tags stays
          // because tag filtering below is client-side.
          //
          // Deliberately NOT limited: search and the tag/date filters
          // all run over the loaded array, so capping rows here would
          // silently hide older conversations from them. Narrowing the
          // payload is the safe win; server-side filtering with real
          // pagination is the follow-up.
          .select(
            "*, contact:contacts(id, name, phone, avatar_url, instagram_id, messenger_id, contact_tags(tag_id))",
          )
          .order("last_message_at", { ascending: false }))();

      if (cancelled) return;

      if (convsRes.error) {
        console.error("Failed to fetch conversations:", {
          message: convsRes.error.message,
          details: convsRes.error.details,
          hint: convsRes.error.hint,
          code: convsRes.error.code,
        });
        setLoading(false);
        return;
      }

      onConversationsLoadedRef.current((convsRes.data ?? []) as Conversation[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [resyncToken]);

  const filtered = useMemo(() => {
    let result = conversations as ConversationWithTags[];

    if (channel !== "all") {
      // Legacy rows predating migration 044 have no channel — treat them
      // as WhatsApp so they don't vanish under the WhatsApp tab.
      result = result.filter((c) => (c.channel ?? "whatsapp") === channel);
    }

    result = result.filter((c) => matchesFilters(c, filters, now));

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const instagramId = c.contact?.instagram_id?.toLowerCase() ?? "";
        const messengerId = c.contact?.messenger_id?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return (
          name.includes(q) ||
          phone.includes(q) ||
          instagramId.includes(q) ||
          messengerId.includes(q) ||
          lastMsg.includes(q)
        );
      });
    }

    return result;
  }, [
    conversations,
    channel,
    filters,
    now,
    search,
  ]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
    []
  );

  const handleSelect = useCallback(
    (conv: Conversation) => onSelect(conv),
    [onSelect]
  );

  const filterMembers = useMemo(
    () =>
      profiles
        .filter((p) => p.user_id)
        .map((p) => ({
          userId: p.user_id as string,
          name: p.full_name || p.email || "Teammate",
          avatarUrl: p.avatar_url ?? null,
        })),
    [profiles],
  );

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-card lg:w-96">
      {/* Channel bar — every connected channel is a pill with its logo and
          name; the ones this account hasn't connected follow as
          full-colour but non-clickable logos, each split off by a vertical
          divider and explaining themselves with a tooltip on hover. */}
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
        {channelTabs.map((opt) => {
          const active = channel === opt.value;
          const Logo = opt.Logo;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setChannelChoice(opt.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors",
                active
                  ? "bg-primary-soft text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {Logo && <Logo className="size-4 shrink-0" />}
              {opt.label}
            </button>
          );
        })}

        {/* Not-connected channels. A divider precedes each one, so the row
            reads WhatsApp │ Instagram │ Messenger. The trigger is a span
            (not a disabled button) so hover still fires the tooltip;
            cursor-not-allowed + aria-disabled convey it can't be picked.
            The tooltip names the way to fix it rather than just saying
            no — connecting is two clicks away in Settings. */}
        {comingSoonChannels.map((opt) => {
          const Logo = opt.Logo;
          const hint = `${opt.label} — connect it in Settings → Instagram & Messenger`;
          return (
            <Fragment key={opt.value}>
              <span
                aria-hidden
                className="h-4 w-px shrink-0 bg-border"
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      aria-disabled
                      aria-label={hint}
                      className="flex cursor-not-allowed items-center opacity-60 transition-opacity hover:opacity-100"
                    >
                      {Logo && <Logo className="size-4 shrink-0" />}
                    </span>
                  }
                />
                <TooltipContent>{hint}</TooltipContent>
              </Tooltip>
            </Fragment>
          );
        })}
      </div>

      {/* Search, and every filter behind one button beside it. */}
      <div className="flex items-center gap-2 border-b border-border p-3">
        {/* No box — the glyph and placeholder over an underline that
            turns primary while typing. */}
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search conversations..."
            className="h-9 rounded-none border-0 border-b border-border bg-transparent pr-0 pl-6 text-sm text-foreground focus-visible:border-primary focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <InboxFilterMenu
          filters={filters}
          onChange={setFilters}
          tags={availableTags}
          members={filterMembers}
        />
      </div>

      {/* Conversation Items */}
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {activeCount(filters) > 0
                ? "No chats match these filters"
                : "No conversations found"}
            </p>
            {activeCount(filters) > 0 && (
              <button
                type="button"
                onClick={() => setFilters({ ...EMPTY_FILTERS, match: filters.match })}
                className="mt-2 text-xs font-medium text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((conv) => {
              const c = conv as Conversation;
              const assignee = c.assigned_agent_id
                ? memberById.get(c.assigned_agent_id)
                : undefined;
              return (
                <ConversationItem
                  key={conv.id}
                  conversation={c}
                  isActive={conv.id === activeConversationId}
                  onSelect={handleSelect}
                  tagMap={tagMap}
                  flows={flows}
                  onAssignFlow={assignFlow}
                  assignedAgentName={assignee?.name}
                  assignedAgentAvatar={assignee?.avatarUrl ?? null}
                />
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─── Window period timer ───────────────────────────────────────────────────

const WINDOW_HOURS = 24;

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatWindowRemaining(minutesLeft: number): string {
  if (minutesLeft < 1) return "< 1m left";
  if (minutesLeft < 60) return `${minutesLeft}m left`;
  const h = Math.floor(minutesLeft / 60);
  const m = minutesLeft % 60;
  return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
}

function WindowBadge({ customerRepliedAt }: { customerRepliedAt: string }) {
  const now = useNow();
  const minutesLeft =
    WINDOW_HOURS * 60 - differenceInMinutes(now, new Date(customerRepliedAt));
  if (minutesLeft <= 0) return null;

  const urgent = minutesLeft < 120;
  const warn = minutesLeft < 360;

  return (
    <span
      className={cn(
        "shrink-0 rounded px-1 py-px text-[10px] font-medium leading-none",
        urgent
          ? "bg-red-100 text-red-600"
          : warn
            ? "bg-amber-100 text-amber-600"
            : "bg-primary-soft text-primary",
      )}
    >
      {formatWindowRemaining(minutesLeft)}
    </span>
  );
}

// ─── Conversation row ──────────────────────────────────────────────────────

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  tagMap: Map<string, Tag>;
  flows: FlowOption[];
  onAssignFlow: (conversationId: string, flowId: string | null) => void;
  /** Display name of the assigned teammate, if any. */
  assignedAgentName?: string;
  /** Avatar of the assigned teammate, if they have one. */
  assignedAgentAvatar?: string | null;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  tagMap,
  flows,
  onAssignFlow,
  assignedAgentName,
  assignedAgentAvatar,
}: ConversationItemProps) {
  const contact = conversation.contact as ContactWithTags | undefined;
  const displayName =
    contact?.name ||
    contact?.phone ||
    contact?.instagram_id ||
    contact?.messenger_id ||
    "Unknown";
  const initials = displayName.charAt(0).toUpperCase();
  const avatar = avatarColor(contact?.id || displayName);
  const channelOpt = CHANNEL_OPTIONS.find(
    (o) => o.value === (conversation.channel ?? "whatsapp"),
  );
  const ChannelMark = channelOpt?.Logo;

  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: false })
    : "";

  // Resolve the contact's tags to displayable chips.
  const tags = (contact?.contact_tags ?? [])
    .map((ct) => tagMap.get(ct.tag_id))
    .filter((t): t is Tag => Boolean(t));

  const assignedFlowId = conversation.assigned_flow_id ?? null;
  const assignedFlow = flows.find((f) => f.id === assignedFlowId);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 px-3 py-3.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50",
        isActive && "border-l-2 border-primary bg-muted/70",
      )}
    >
      {/* Avatar — WhatsApp-style tonal colour: deep bg + brighter initial
          of the same hue, stable per contact. */}
      <div className="relative shrink-0">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold"
          style={{ backgroundColor: avatar.bg, color: avatar.fg }}
        >
          {contact?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contact.avatar_url}
              alt={displayName}
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        {/* Channel badge — the platform's own logo on a white chip at
            the avatar's bottom-right, for every channel, so a mixed
            inbox reads at a glance. No `channel` = a pre-044 WhatsApp
            thread. */}
        {ChannelMark && (
          <span
            title={channelOpt?.label}
            className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-card ring-2 ring-card"
          >
            <ChannelMark className="size-4" />
          </span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">
              {displayName}
            </span>
            {conversation.customer_replied_at && (
              <WindowBadge customerRepliedAt={conversation.customer_replied_at} />
            )}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo}</span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">
            {conversation.last_message_text || "No messages yet"}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {conversation.unread_count > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {conversation.unread_count}
              </span>
            )}
            <span
              className={cn("h-2 w-2 rounded-full", STATUS_COLORS[conversation.status])}
              title={conversation.status}
            />
          </div>
        </div>

        {/* Tags + bot control */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex max-w-24 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: `${tag.color}20`, color: tag.color }}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: tag.color }}
                />
                <span className="truncate">{tag.name}</span>
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{tags.length - 3}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* Who's handling it — shown beside the bot chip when a
                teammate is assigned to the conversation. Carries the
                teammate's dp (avatar, or coloured initials fallback). */}
            {assignedAgentName && (
              <span
                title={`Assigned to ${assignedAgentName}`}
                className="inline-flex max-w-32 items-center gap-1.5 rounded-full bg-muted py-1 pr-3 pl-1 text-[11px] font-medium text-foreground"
              >
                {assignedAgentAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={assignedAgentAvatar}
                    alt={assignedAgentName}
                    className="size-5 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
                    style={(() => {
                      const c = avatarColor(assignedAgentName);
                      return { backgroundColor: c.bg, color: c.fg };
                    })()}
                  >
                    {assignedAgentName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="truncate">{assignedAgentName}</span>
              </span>
            )}

            <BotControl
              conversationId={conversation.id}
              assignedFlowId={assignedFlowId}
              assignedFlowName={assignedFlow?.name}
              flows={flows}
              onAssignFlow={onAssignFlow}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Per-row bot assign / unassign ─────────────────────────────────────────

function BotControl({
  conversationId,
  assignedFlowId,
  assignedFlowName,
  flows,
  onAssignFlow,
}: {
  conversationId: string;
  assignedFlowId: string | null;
  assignedFlowName?: string;
  flows: FlowOption[];
  onAssignFlow: (conversationId: string, flowId: string | null) => void;
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={stop}
        title={assignedFlowId ? "Bot assigned" : "Assign a bot"}
        className={cn(
          "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors",
          assignedFlowId
            ? "bg-primary-soft text-primary"
            : "border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary",
        )}
      >
        <Bot className="h-3 w-3" />
        <span className="max-w-20 truncate">
          {assignedFlowId ? assignedFlowName ?? "Bot" : "Bot"}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-border bg-popover min-w-44" onClick={stop}>
        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Assign bot
        </div>
        {flows.length === 0 ? (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            No active bots
          </DropdownMenuItem>
        ) : (
          flows.map((f) => {
            const active = f.id === assignedFlowId;
            return (
              <DropdownMenuItem
                key={f.id}
                onClick={(e) => {
                  stop(e);
                  onAssignFlow(conversationId, f.id);
                }}
                className={cn("text-sm", active ? "text-primary" : "text-popover-foreground")}
              >
                <Bot className="size-4" />
                <span className="flex-1 truncate">{f.name}</span>
                {active && <Check className="size-3.5" />}
              </DropdownMenuItem>
            );
          })
        )}
        {assignedFlowId && (
          <>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={(e) => {
                stop(e);
                onAssignFlow(conversationId, null);
              }}
              className="text-sm text-muted-foreground"
            >
              Unassign bot
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
