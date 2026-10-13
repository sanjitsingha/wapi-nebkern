"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { avatarColor } from "@/lib/avatar-color";
import { cn } from "@/lib/utils";
import type { Contact, Conversation, Deal, Profile, Tag } from "@/types";
import {
  AtSign,
  Phone,
  Mail,
  Copy,
  Check,
  Tag as TagIcon,
  IndianRupee,
  Plus,
  X,
  ShieldAlert,
  ShieldCheck,
  PanelRightClose,
  ExternalLink,
  PhoneCall,
  AlertCircle,
  ChevronDown,
  LayoutList,
  Users,
  SlidersHorizontal,
  Blocks,
  Link2,
  Sparkles,
  Bot,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useCallCenter } from "@/components/calls/call-center";
import { ContactCallHistory } from "@/components/calls/contact-call-history";
import { TeamThread } from "@/components/inbox/team-thread";
import { IntegrationsTab } from "@/components/inbox/integrations-tab";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PersonAvatar } from "@/components/ui/person-avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDetailedMetaError } from "@/lib/whatsapp/errors";
import { toast } from "sonner";

type PanelTab =
  | 'overview'
  | 'deals'
  | 'calls'
  | 'team'
  | 'issues'
  | 'details'
  | 'integrations';

interface ContactSidebarProps {
  contact: Contact | null;
  /** The open conversation, for the Details tab's chat facts. Optional
   *  so the panel still renders for a contact with no thread loaded. */
  conversation?: Conversation | null;
  onTogglePanel?: () => void;
}

export function ContactSidebar({
  contact,
  conversation,
  onTogglePanel,
}: ContactSidebarProps) {
  // Null outside the dashboard shell (the provider lives there), which is
  // why every use below is optional rather than assumed.
  const callCenter = useCallCenter();
  const { user, accountId } = useAuth();
  /** Which tab of the panel is showing. Resets to Overview on a
   *  contact change — landing in someone else's team thread because
   *  that is where you were last is disorienting. */
  const [tab, setTab] = useState<PanelTab>('overview');
  const [unreadTeamCount, setUnreadTeamCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [savingTag, setSavingTag] = useState(false);
  const [recentFailures, setRecentFailures] = useState<{
    id: string;
    content_text: string | null;
    template_name: string | null;
    error_message: string | null;
    created_at: string;
  }[]>([]);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [flowName, setFlowName] = useState<{ id: string; name: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  // Keyed on the id, not the object: the parent swaps in a fresh
  // contact object when a field changes (e.g. spam from the thread
  // menu), and that must not throw the agent back to Overview.
  const contactId = contact?.id;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab('overview');
  }, [contactId]);

  const fetchContactData = useCallback(async () => {
    if (!contactId) return;

    const supabase = createClient();

    // Deals, tags and failed messages in parallel.
    const [dealsRes, tagsRes, convsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contactId),
      supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", contactId),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }

    const convIds = (convsRes.data ?? []).map((c) => c.id);
    if (convIds.length > 0) {
      const { data: failed } = await supabase
        .from("messages")
        .select("id, content_text, template_name, error_message, created_at")
        .in("conversation_id", convIds)
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(4);
      setRecentFailures((failed as typeof recentFailures) ?? []);
    } else {
      setRecentFailures([]);
    }
  }, [contactId]);

  // Load on contact change. setContactData/setTags run inside async
  // Supabase callbacks, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  // All tags (once) — the "Add tag" picker chooses from these.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("tags")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (!cancelled && data) setAllTags(data as Tag[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Profiles (once) — the Details tab names the assigned agent. Same
  // RLS-bounded query the thread header's assign menu uses.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .then(({ data }) => {
        if (!cancelled && data) setProfiles(data as Profile[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Name of the bot flow driving this conversation, if any.
  const assignedFlowId = conversation?.assigned_flow_id ?? null;
  useEffect(() => {
    if (!assignedFlowId) return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("flows")
      .select("id, name")
      .eq("id", assignedFlowId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setFlowName(data as { id: string; name: string });
      });
    return () => {
      cancelled = true;
    };
  }, [assignedFlowId]);

  const copyValue = useCallback(async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }, []);

  // Fetch unread team messages count
  const fetchUnreadTeamMessages = useCallback(async () => {
    if (!contact?.id || !user?.id) return;
    const supabase = createClient();
    const storageKey = `team_thread_seen_${user.id}_${contact.id}`;
    const lastSeen = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;

    let query = supabase
      .from('contact_thread_messages')
      .select('id, created_at, author_id', { count: 'exact', head: true })
      .eq('contact_id', contact.id)
      .is('deleted_at', null)
      .neq('author_id', user.id);

    if (lastSeen) {
      query = query.gt('created_at', lastSeen);
    }

    const { count, error } = await query;
    if (!error && typeof count === 'number') {
      setUnreadTeamCount(count);
    }
  }, [contact?.id, user?.id]);

  useEffect(() => {
    if (!contact?.id || !user?.id) {
      setUnreadTeamCount(0);
      return;
    }

    if (tab === 'team') {
      const storageKey = `team_thread_seen_${user.id}_${contact.id}`;
      localStorage.setItem(storageKey, new Date().toISOString());
      setUnreadTeamCount(0);
      return;
    }

    void fetchUnreadTeamMessages();
  }, [contact?.id, user?.id, tab, fetchUnreadTeamMessages]);

  // Live updates for unseen team messages
  useEffect(() => {
    if (!contact?.id || !accountId || !user?.id) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`contact-team-unread:${contact.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contact_thread_messages',
          filter: `contact_id=eq.${contact.id}`,
        },
        (payload) => {
          const row = payload.new as { author_id?: string };
          if (!row || row.author_id === user.id) return;

          if (tabRef.current === 'team') {
            const storageKey = `team_thread_seen_${user.id}_${contact.id}`;
            localStorage.setItem(storageKey, new Date().toISOString());
            setUnreadTeamCount(0);
          } else {
            setUnreadTeamCount((prev) => prev + 1);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [contact?.id, accountId, user?.id]);

  // Add or remove a tag on this contact, updating local state instantly.
  const toggleTag = useCallback(
    async (tag: Tag) => {
      if (!contact || savingTag) return;
      setSavingTag(true);
      const supabase = createClient();
      const existing = tags.find((t) => t.id === tag.id);
      try {
        if (existing) {
          const { error } = await supabase
            .from("contact_tags")
            .delete()
            .eq("id", existing.contact_tag_id);
          if (error) throw error;
          setTags((prev) => prev.filter((t) => t.id !== tag.id));
        } else {
          const { data, error } = await supabase
            .from("contact_tags")
            .insert({ contact_id: contact.id, tag_id: tag.id })
            .select("id")
            .single();
          if (error) throw error;
          setTags((prev) => [
            ...prev,
            { ...tag, contact_tag_id: data.id as string },
          ]);
        }
      } catch {
        toast.error("Couldn't update tags. Please try again.");
      } finally {
        setSavingTag(false);
      }
    },
    [contact, tags, savingTag],
  );

  const handleCopyPhone = useCallback(async () => {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Dep is the whole `contact` object (not `contact?.phone`) so the
    // React Compiler's inference agrees with the manual dep list —
    // fixes the `preserve-manual-memoization` lint error.
  }, [contact]);

  const handleCopyInstagramId = useCallback(async () => {
    if (!contact?.instagram_id) return;
    await navigator.clipboard.writeText(contact.instagram_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [contact]);

  const selectTab = (key: PanelTab) => {
    setTab(key);
    if (key === 'team' && contact?.id && user?.id) {
      const storageKey = `team_thread_seen_${user.id}_${contact.id}`;
      localStorage.setItem(storageKey, new Date().toISOString());
      setUnreadTeamCount(0);
    }
  };

  const collapseButton = onTogglePanel && (
    <button
      type="button"
      onClick={onTogglePanel}
      aria-label="Hide contact panel"
      title="Collapse panel"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <PanelRightClose className="h-4 w-4" />
    </button>
  );

  if (!contact) {
    return (
      <div className="flex h-full w-88 flex-col border-l border-border bg-card">
        <div className="flex items-center border-b border-border px-3 py-2.5">
          {collapseButton}
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Select a conversation</p>
        </div>
      </div>
    );
  }

  const displayName =
    contact.name || contact.phone || contact.instagram_id || "Unknown";
  const initials = displayName.charAt(0).toUpperCase();
  const avatar = avatarColor(contact.id || displayName);

  // Calls are WhatsApp-only, so the tab is left out entirely for a
  // contact with no number rather than shown permanently empty.
  const tabs: {
    key: PanelTab;
    label: string;
    icon: LucideIcon;
    badge?: number;
    tone?: 'alert';
  }[] = [
    { key: 'overview', label: 'Overview', icon: LayoutList },
    { key: 'deals', label: 'Deals', icon: IndianRupee, badge: deals.length },
    ...(contact.phone
      ? [{ key: 'calls' as const, label: 'Calls', icon: PhoneCall }]
      : []),
    {
      key: 'team',
      label: 'Team Inbox',
      icon: Users,
      badge: tab === 'team' ? 0 : unreadTeamCount,
      tone: 'alert',
    },
    {
      key: 'issues',
      label: 'Delivery issues',
      icon: AlertCircle,
      badge: recentFailures.length,
      tone: 'alert',
    },
    { key: 'details', label: 'Details', icon: SlidersHorizontal },
    { key: 'integrations', label: 'Integrations', icon: Blocks },
  ];

  return (
    <div className="flex h-full w-88 flex-col border-l border-border bg-card">
      {/* Who this is, and what you can do to them, always in view
          whichever tab is open. */}
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        {/* Same seed as the conversation list and thread header so a
            contact's colour is identical everywhere. */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-semibold"
          style={{ backgroundColor: avatar.bg, color: avatar.fg }}
        >
          {contact.avatar_url ? (
            <img
              src={contact.avatar_url}
              alt={displayName}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <Link
            href={`/contacts/${contact.id}`}
            title="Open contact"
            className="block truncate text-sm font-semibold text-foreground hover:text-primary hover:underline underline-offset-2"
          >
            {displayName}
          </Link>
          {contact.company && (
            <p className="truncate text-xs text-muted-foreground">{contact.company}</p>
          )}
          {contact.is_spam && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <ShieldAlert className="h-3 w-3" />
              Marked as spam
            </span>
          )}
          {contact.phone && callCenter && (
            <div className="mt-1.5 flex items-center gap-0.5 -ml-1.5">
              <HeaderAction
                label="Call"
                onClick={() => void callCenter.placeCall(contact.phone!, displayName)}
                disabled={callCenter.busy}
              >
                <PhoneCall className="h-4 w-4" />
              </HeaderAction>
            </div>
          )}
        </div>
        {collapseButton}
      </div>

      {/* Icon tabs: the open one spells out its name, the rest are
          icons with a tooltip, so five views fit the 352px panel. A
          chat needs its own height and scroll, which is why the team
          thread is a tab rather than appended under the details. */}
      <div
        role="tablist"
        aria-label="Contact panel"
        className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map(({ key, label, icon: Icon, badge, tone }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={active}
              aria-label={label}
              title={label}
              onClick={() => selectTab(key)}
              className={cn(
                'relative flex shrink-0 items-center gap-1.5 px-2 py-3 text-xs font-medium transition-colors',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="relative">
                <Icon className="h-4.5 w-4.5" />
                {!active && !!badge && badge > 0 && (
                  <span
                    className={cn(
                      'absolute -top-1.5 -right-2 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none animate-in fade-in zoom-in-75',
                      tone === 'alert'
                        ? 'bg-red-500 text-white'
                        : 'bg-muted-foreground/15 text-foreground',
                    )}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              {active && <span className="whitespace-nowrap">{label}</span>}
              {active && (
                <span className="bg-primary absolute inset-x-1.5 bottom-0 h-0.5 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {tab === 'team' ? (
        <TeamThread contactId={contact.id} />
      ) : (
      /* `min-h-0` is load-bearing. A flex child defaults to
          `min-height: auto`, which refuses to shrink below its content —
          so with enough in the panel this grew past the column instead
          of scrolling, pushing everything below it out of reach. The
          overflow was always set up correctly; it just never had a
          bounded height to overflow against. */
      <ScrollArea className="min-h-0 flex-1">
        {tab === 'overview' && (
          <>
            <PanelSection title="Contact details">
              {contact.phone || contact.instagram_id || contact.email ? (
                <div className="space-y-0.5">
                  {contact.phone && (
                    <button
                      onClick={handleCopyPhone}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-left">{contact.phone}</span>
                      {copied ? (
                        <Check className="h-3 w-3 text-primary" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  {contact.instagram_id && (
                    <button
                      onClick={handleCopyInstagramId}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <AtSign className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate text-left">
                        {contact.instagram_id}
                      </span>
                      {copied ? (
                        <Check className="h-3 w-3 text-primary" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                </div>
              ) : (
                <PanelEmpty
                  icon={Phone}
                  title="No contact details"
                  hint="Add a phone number or email on the contact page."
                />
              )}
            </PanelSection>

            <PanelSection
              title="Tags"
              action={
                <Popover onOpenChange={(open) => !open && setTagSearch("")}>
                  <PopoverTrigger className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none data-popup-open:bg-muted data-popup-open:text-foreground">
                    <Plus className="h-3 w-3" />
                    Add
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 gap-0 p-0">
                    {allTags.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                        No tags yet. Create tags in Settings.
                      </p>
                    ) : (
                      <>
                        <div className="border-b border-border p-2">
                          <input
                            value={tagSearch}
                            onChange={(e) => setTagSearch(e.target.value)}
                            placeholder="Search tags…"
                            autoFocus
                            className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto p-1">
                          {allTags
                            .filter((t) =>
                              t.name
                                .toLowerCase()
                                .includes(tagSearch.trim().toLowerCase()),
                            )
                            .map((tag) => {
                              const active = tags.some((t) => t.id === tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => toggleTag(tag)}
                                  disabled={savingTag}
                                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted disabled:opacity-60"
                                >
                                  <span
                                    className="size-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: tag.color }}
                                  />
                                  <span className="flex-1 truncate text-xs text-foreground">
                                    {tag.name}
                                  </span>
                                  {active && (
                                    <Check className="size-3.5 shrink-0 text-primary" />
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              }
            >
              {tags.length === 0 ? (
                <PanelEmpty
                  icon={TagIcon}
                  title="No tags"
                  hint="Tag this contact to filter and segment them later."
                />
              ) : (
                <div className="flex flex-wrap gap-1 px-1">
                  {tags.map((tag, idx) => (
                    <span
                      key={tag.contact_tag_id || `${tag.id}-${idx}`}
                      className="group/tag inline-flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                      }}
                    >
                      {tag.name}
                      <button
                        type="button"
                        onClick={() => toggleTag(tag)}
                        disabled={savingTag}
                        aria-label={`Remove ${tag.name}`}
                        className="flex size-3.5 items-center justify-center rounded-full opacity-60 transition-opacity hover:bg-black/10 hover:opacity-100 disabled:opacity-40"
                      >
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </PanelSection>

            <PanelSection title="Activity">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['deals', 'Deals', deals.length],
                    ['issues', 'Failed', recentFailures.length],
                    ['team', 'Team', unreadTeamCount],
                  ] as const
                ).map(([key, label, value]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectTab(key)}
                    className="rounded-lg border border-border px-2 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <p
                      className={cn(
                        'text-base font-semibold',
                        key !== 'deals' && value > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-foreground',
                      )}
                    >
                      {value}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {key === 'team' ? 'Unread notes' : label}
                    </p>
                  </button>
                ))}
              </div>
            </PanelSection>
          </>
        )}

        {tab === 'deals' && (
          <PanelSection title="Active deals" count={deals.length}>
            {deals.length === 0 ? (
              <PanelEmpty
                icon={IndianRupee}
                title="No deals"
                hint="Deals for this contact in any pipeline show up here."
              />
            ) : (
              <div className="space-y-2">
                {deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg border border-border px-3 py-2.5"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {deal.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {deal.currency ?? "$"}
                        {deal.value.toLocaleString()}
                      </span>
                      {deal.stage && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: `${deal.stage.color}20`,
                            color: deal.stage.color,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelSection>
        )}

        {tab === 'calls' && contact.phone && (
          <PanelSection title="Call history">
            <ContactCallHistory contactId={contact.id} />
          </PanelSection>
        )}

        {tab === 'issues' && (
          <PanelSection
            title="Recent delivery failures"
            count={recentFailures.length}
          >
            {recentFailures.length === 0 ? (
              <PanelEmpty
                icon={ShieldCheck}
                title="No delivery failures"
                hint="Messages that fail to reach this contact show up here, with the reason Meta gave."
              />
            ) : (
              <div className="space-y-2">
                {recentFailures.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-red-200 bg-red-50/70 p-2.5 dark:border-red-500/20 dark:bg-red-950/30 text-xs"
                  >
                    <div className="flex items-baseline justify-between gap-1 text-[11px]">
                      <span className="font-semibold text-red-700 dark:text-red-400 truncate">
                        {item.template_name ? `Template: ${item.template_name}` : "Direct Message"}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {item.content_text && (
                      <p className="mt-1 line-clamp-2 text-foreground/80 text-[11px]">
                        {item.content_text}
                      </p>
                    )}
                    {/* `whitespace-pre-line` — the formatter returns
                        the code, explanation, Meta's specifics and
                        the fix on separate lines. */}
                    <div className="mt-1.5 rounded bg-red-100/80 px-2 py-1 text-[11px] font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300 leading-snug whitespace-pre-line">
                      {formatDetailedMetaError(item.error_message)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelSection>
        )}
        {tab === 'integrations' && <IntegrationsTab contactId={contact.id} />}

        {tab === 'details' && (
          <DetailsTab
            contact={contact}
            conversation={conversation ?? null}
            profiles={profiles}
            flowName={
              flowName && flowName.id === assignedFlowId ? flowName.name : null
            }
            copiedKey={copiedKey}
            onCopy={copyValue}
          />
        )}
      </ScrollArea>
      )}
    </div>
  );
}

const CHANNEL_LABEL: Record<Conversation['channel'], string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
};

const STATUS_STYLE: Record<Conversation['status'], string> = {
  open: 'border-primary/30 bg-primary-soft text-primary',
  pending:
    'border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  closed: 'border-border bg-muted text-muted-foreground',
};

function formatWhen(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : format(d, 'd MMM yyyy, HH:mm');
}

/** Read-only facts about the chat and the contact — the things you
 *  otherwise go to the contact page or the database to find out. Rows
 *  with no value are left out rather than shown as dashes. */
function DetailsTab({
  contact,
  conversation,
  profiles,
  flowName,
  copiedKey,
  onCopy,
}: {
  contact: Contact;
  conversation: Conversation | null;
  profiles: Profile[];
  flowName: string | null;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}) {
  const assignee = (() => {
    if (!conversation) return null;
    if (conversation.ai_agent_assigned) {
      return { label: 'AI agent', icon: Sparkles };
    }
    if (conversation.assigned_flow_id) {
      return { label: flowName ? `Bot · ${flowName}` : 'Bot flow', icon: Bot };
    }
    if (conversation.assigned_agent_id) {
      const p = profiles.find((x) => x.user_id === conversation.assigned_agent_id);
      return { label: p?.full_name || p?.email || 'Team member', profile: p };
    }
    return { label: 'Unassigned', icon: UserRound };
  })();

  // Which Zoho record this person is synced with, when Zoho is
  // connected. Keyed by contact so a fast switch never shows the
  // previous person's link.
  const [zoho, setZoho] = useState<{
    contactId: string;
    connected: boolean;
    link: { module: 'Leads' | 'Contacts'; url: string | null } | null;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/integrations/zoho/link?contact_id=${contact.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) {
          setZoho({ contactId: contact.id, connected: !!d.connected, link: d.link ?? null });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [contact.id]);
  const zohoHere = zoho?.contactId === contact.id ? zoho : null;

  // Ticks once a minute so the reply-window countdown stays current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // WhatsApp only allows free-form replies within 24h of the customer's
  // last message; outside it you need a template.
  const replyWindow = (() => {
    if (!conversation || conversation.channel !== 'whatsapp') return null;
    if (!conversation.customer_replied_at) return { open: false, label: 'Closed' };
    const closesAt = new Date(conversation.customer_replied_at).getTime() + 24 * 3600 * 1000;
    return closesAt > now
      ? { open: true, label: `Open · closes ${formatDistanceToNow(closesAt, { addSuffix: true })}` }
      : { open: false, label: 'Closed · template needed' };
  })();

  const address = [contact.street, contact.locality, contact.city, contact.state, contact.pin_code, contact.country]
    .filter(Boolean)
    .join(', ');

  const chatLink =
    conversation && typeof window !== 'undefined'
      ? `${window.location.origin}/inbox?c=${conversation.id}`
      : null;

  return (
    <div className="px-4 py-2">
      {conversation && (
        <>
          <DetailGroup label="Chat" />
          <DetailRow label="Chat ID">
            <CopyValue
              value={conversation.id}
              copied={copiedKey === 'conv'}
              onCopy={() => onCopy('conv', conversation.id)}
            />
          </DetailRow>
          <DetailRow label="Channel">{CHANNEL_LABEL[conversation.channel]}</DetailRow>
          <DetailRow label="Status">
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
                STATUS_STYLE[conversation.status],
              )}
            >
              {conversation.status}
            </span>
          </DetailRow>
          {assignee && (
            <DetailRow label="Assigned to">
              <span className="inline-flex max-w-48 items-center gap-2">
                {'icon' in assignee && assignee.icon ? (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <assignee.icon className="size-3.5" />
                  </span>
                ) : (
                  // Seeded with the name, as the thread's assign control
                  // does, so the teammate keeps one colour everywhere.
                  <PersonAvatar
                    name={assignee.label}
                    avatarUrl={'profile' in assignee ? assignee.profile?.avatar_url : null}
                    className="size-6 text-[11px]"
                  />
                )}
                <span className="truncate">{assignee.label}</span>
              </span>
            </DetailRow>
          )}
          {formatWhen(conversation.created_at) && (
            <DetailRow label="Started">{formatWhen(conversation.created_at)}</DetailRow>
          )}
          {formatWhen(conversation.last_message_at) && (
            <DetailRow label="Last message">{formatWhen(conversation.last_message_at)}</DetailRow>
          )}
          {formatWhen(conversation.customer_replied_at) && (
            <DetailRow label="Customer last replied">
              {formatWhen(conversation.customer_replied_at)}
            </DetailRow>
          )}
          {replyWindow && (
            <DetailRow label="24h reply window">
              <span
                className={cn(
                  'text-right',
                  replyWindow.open ? 'text-primary' : 'text-amber-600 dark:text-amber-400',
                )}
              >
                {replyWindow.label}
              </span>
            </DetailRow>
          )}
        </>
      )}

      <DetailGroup label="Contact" />
      <DetailRow label="Contact ID">
        <CopyValue
          value={contact.id}
          copied={copiedKey === 'contact'}
          onCopy={() => onCopy('contact', contact.id)}
        />
      </DetailRow>
      {formatWhen(contact.created_at) && (
        <DetailRow label="Added on">{formatWhen(contact.created_at)}</DetailRow>
      )}
      {contact.messenger_id && (
        <DetailRow label="Messenger ID">
          <CopyValue
            value={contact.messenger_id}
            copied={copiedKey === 'psid'}
            onCopy={() => onCopy('psid', contact.messenger_id!)}
          />
        </DetailRow>
      )}
      {contact.date_of_birth && (
        <DetailRow label="Date of birth">
          {format(new Date(contact.date_of_birth), 'd MMM yyyy')}
        </DetailRow>
      )}
      {contact.marital_status && (
        <DetailRow label="Marital status">
          {contact.marital_status}
          {contact.spouse_name ? ` · ${contact.spouse_name}` : ''}
        </DetailRow>
      )}
      {address && <DetailRow label="Address">{address}</DetailRow>}

      {zohoHere?.connected && (
        <DetailRow label="Zoho CRM">
          {zohoHere.link ? (
            zohoHere.link.url ? (
              <a
                href={zohoHere.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline underline-offset-2"
              >
                {zohoHere.link.module === 'Leads' ? 'Lead' : 'Contact'}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : zohoHere.link.module === 'Leads' ? 'Lead' : 'Contact'
          ) : (
            'Not synced yet'
          )}
        </DetailRow>
      )}

      <DetailGroup label="Preferences" />
      <DetailRow label="Marketing">
        <YesNo on={!contact.marketing_opt_out} yes="Opted in" no="Opted out" />
      </DetailRow>
      <DetailRow label="Notifications">
        <YesNo on={!contact.is_muted} yes="On" no="Muted" />
      </DetailRow>
      <DetailRow label="Blocked">
        <YesNo on={!contact.is_blocked} yes="No" no="Yes" />
      </DetailRow>

      <DetailGroup label="Actions" />
      <div className="space-y-0.5 pb-2">
        {chatLink && (
          <button
            type="button"
            onClick={() => onCopy('link', chatLink)}
            className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            {copiedKey === 'link' ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Link2 className="h-4 w-4 text-muted-foreground" />
            )}
            {copiedKey === 'link' ? 'Link copied' : 'Copy chat link'}
          </button>
        )}
        <Link
          href={`/contacts/${contact.id}`}
          className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
        >
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
          Edit contact
        </Link>
      </div>
    </div>
  );
}

function DetailGroup({ label }: { label: string }) {
  return (
    <div className="mt-3 mb-1 flex items-center gap-3 first:mt-1">
      <span className="text-[11px] font-medium text-muted-foreground/80">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 font-medium text-foreground">{label}</span>
      <span className="min-w-0 text-right text-muted-foreground">{children}</span>
    </div>
  );
}

function CopyValue({
  value,
  copied,
  onCopy,
}: {
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      title={value}
      className="inline-flex max-w-44 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="truncate font-mono text-xs">{value}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-primary" />
      ) : (
        <Copy className="h-3 w-3 shrink-0" />
      )}
    </button>
  );
}

function YesNo({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[11px] font-medium',
        on
          ? 'border-primary/30 bg-primary-soft text-primary'
          : 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400',
      )}
    >
      {on ? yes : no}
    </span>
  );
}

function HeaderAction({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A collapsible block inside a tab — caret, small title, optional
 *  count and a trailing action that sits outside the toggle button so
 *  it never nests one button in another. */
function PanelSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b border-border px-3 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', !open && '-rotate-90')}
          />
          {title}
          {!!count && count > 0 && (
            <span className="ml-0.5 font-medium text-muted-foreground/70">({count})</span>
          )}
        </button>
        {action}
      </div>
      {open && <div className="mt-2">{children}</div>}
    </section>
  );
}

function PanelEmpty({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-5 text-center">
      <Icon className="h-6 w-6 text-muted-foreground/50" />
      <p className="mt-2 text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">{hint}</p>
    </div>
  );
}
