"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationStatus, Profile, Tag } from "@/types";
import {
  AtSign,
  Search,
  ChevronDown,
  Tag as TagIcon,
  X,
  Bot,
  Check,
  SlidersHorizontal,
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
import {
  InboxFiltersDialog,
  type AssigneeFilter,
} from "@/components/inbox/inbox-filters-dialog";

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

/** 'YYYY-MM-DD' → the ISO date of the following day (UTC), used as an
 *  exclusive upper bound so a "to" date filter includes the whole day. */
function nextDayISO(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "bg-primary",
  pending: "bg-amber-500",
  closed: "bg-muted-foreground",
};

type InboxFilter = ConversationStatus | "all" | "unread";

const FILTER_OPTIONS: { label: string; value: InboxFilter }[] = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Closed", value: "closed" },
];

// Shared pill-chip styling so every filter control reads as one family.
const CHIP =
  "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors";
const CHIP_ON = "border-primary/30 bg-primary-soft text-primary";
const CHIP_OFF =
  "border-border text-muted-foreground hover:bg-muted hover:text-foreground";

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [assignee, setAssignee] = useState<AssigneeFilter>(null);
  // When the assignee filter is "user", optionally narrow to one agent.
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  // Conversation-started date range ('yyyy-MM-dd' or '' for unset), edited
  // via InboxFiltersDialog alongside the assignee filter.
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Team members — for the "User" assignee filter dropdown.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .order("full_name")
      .then(({ data }) => {
        if (cancelled) return;
        setProfiles((data as Profile[]) ?? []);
      });
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
      const [convsRes, tagsRes] = await Promise.all([
        supabase
          .from("conversations")
          // Include contact_tags so we can filter by tag client-side
          .select("*, contact:contacts(*, contact_tags(tag_id))")
          .order("last_message_at", { ascending: false }),
        supabase.from("tags").select("*").order("name"),
      ]);

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
      setAvailableTags((tagsRes.data ?? []) as Tag[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [resyncToken]);

  const filtered = useMemo(() => {
    let result = conversations as ConversationWithTags[];

    if (filter === "unread") {
      result = result.filter((c) => c.unread_count > 0);
    } else if (filter !== "all") {
      result = result.filter((c) => c.status === filter);
    }

    // Assignee (who's handling the chat): AI Agent / Bot / User. The user
    // filter can be "any assigned agent" or narrowed to a specific one.
    if (assignee === "ai") {
      result = result.filter((c) => c.ai_agent_assigned === true);
    } else if (assignee === "bot") {
      result = result.filter((c) => !!c.assigned_flow_id);
    } else if (assignee === "user") {
      result = result.filter((c) =>
        assignedUserId
          ? c.assigned_agent_id === assignedUserId
          : !!c.assigned_agent_id,
      );
    }

    if (selectedTagId) {
      result = result.filter((c) =>
        c.contact?.contact_tags?.some((ct) => ct.tag_id === selectedTagId)
      );
    }

    if (createdFrom) {
      result = result.filter((c) => c.created_at >= createdFrom);
    }
    if (createdTo) {
      // Exclusive upper bound (start of the day after) so the whole
      // "to" day is included, not just its midnight instant.
      result = result.filter((c) => c.created_at < nextDayISO(createdTo));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const instagramId = c.contact?.instagram_id?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return (
          name.includes(q) ||
          phone.includes(q) ||
          instagramId.includes(q) ||
          lastMsg.includes(q)
        );
      });
    }

    return result;
  }, [
    conversations,
    filter,
    assignee,
    assignedUserId,
    selectedTagId,
    createdFrom,
    createdTo,
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

  const activeFilter = FILTER_OPTIONS.find((o) => o.value === filter);
  const activeTag = availableTags.find((t) => t.id === selectedTagId);
  // Badge count on the "Filter" chip — assignee and date-range together.
  const secondaryFilterCount =
    (assignee !== null ? 1 : 0) + (createdFrom || createdTo ? 1 : 0);

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-card lg:w-96">
      {/* Search + Filters */}
      <div className="space-y-2 border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search conversations..."
            className="border-border bg-muted pl-9 text-sm text-foreground placeholder-muted-foreground focus:border-primary/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 scrollbar-none [&::-webkit-scrollbar]:hidden">
          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(CHIP, filter !== "all" ? CHIP_ON : CHIP_OFF)}>
              {activeFilter?.label ?? "All"}
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="border-border bg-popover">
              {FILTER_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    "text-sm",
                    filter === opt.value ? "text-primary" : "text-popover-foreground"
                  )}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tag filter */}
          {availableTags.length > 0 && (
            activeTag ? (
              // Active tag chip — click × to clear
              <button
                type="button"
                onClick={() => setSelectedTagId(null)}
                className={cn(CHIP, "border-transparent")}
                style={{ background: `${activeTag.color}20`, color: activeTag.color }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: activeTag.color }}
                />
                {activeTag.name}
                <X className="h-2.5 w-2.5 ml-0.5" />
              </button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger className={cn(CHIP, CHIP_OFF)}>
                  <TagIcon className="h-3 w-3" />
                  Tag
                  <ChevronDown className="h-3 w-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="border-border bg-popover min-w-40">
                  {availableTags.map((tag) => (
                    <DropdownMenuItem
                      key={tag.id}
                      onClick={() => setSelectedTagId(tag.id)}
                      className="gap-2 text-sm text-popover-foreground"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: tag.color }}
                      />
                      {tag.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          )}

          {/* Secondary filters — assignee (AI Agent / Bot / team member) and
              conversation date range — live in a modal rather than more
              inline chips, which is where they used to crowd this row. */}
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className={cn(CHIP, secondaryFilterCount > 0 ? CHIP_ON : CHIP_OFF)}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filter
            {secondaryFilterCount > 0 && (
              <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {secondaryFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <InboxFiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        appliedAssignee={assignee}
        appliedAssignedUserId={assignedUserId}
        appliedCreatedFrom={createdFrom}
        appliedCreatedTo={createdTo}
        profiles={profiles}
        onApply={(next) => {
          setAssignee(next.assignee);
          setAssignedUserId(next.assignedUserId);
          setCreatedFrom(next.createdFrom);
          setCreatedTo(next.createdTo);
        }}
      />

      {/* Conversation Items */}
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">No conversations found</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv as Conversation}
                isActive={conv.id === activeConversationId}
                onSelect={handleSelect}
                tagMap={tagMap}
                flows={flows}
                onAssignFlow={assignFlow}
              />
            ))}
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
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  tagMap,
  flows,
  onAssignFlow,
}: ConversationItemProps) {
  const contact = conversation.contact as ContactWithTags | undefined;
  const displayName =
    contact?.name || contact?.phone || contact?.instagram_id || "Unknown";
  const initials = displayName.charAt(0).toUpperCase();
  const avatar = avatarColor(contact?.id || displayName);

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
        {/* Channel badge — only Instagram gets one; a bare avatar reads
            as WhatsApp (the default/majority channel), so this stays
            visually unchanged for every conversation until a second
            channel is actually in play. */}
        {conversation.channel === "instagram" && (
          <span
            title="Instagram"
            className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-card text-foreground ring-2 ring-card"
          >
            <AtSign className="size-3" />
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
