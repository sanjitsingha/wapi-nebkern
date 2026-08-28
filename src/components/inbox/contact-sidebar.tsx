"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { avatarColor } from "@/lib/avatar-color";
import { cn } from "@/lib/utils";
import type { Contact, Deal, Tag } from "@/types";
import {
  AtSign,
  Phone,
  Mail,
  Copy,
  Check,
  Tag as TagIcon,
  DollarSign,
  Plus,
  X,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  PanelRightClose,
  ExternalLink,
  PhoneCall,
  AlertCircle,
} from "lucide-react";
import { useCallCenter } from "@/components/calls/call-center";
import { ContactCallHistory } from "@/components/calls/contact-call-history";
import { TeamThread } from "@/components/inbox/team-thread";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDetailedMetaError } from "@/lib/whatsapp/errors";
import { toast } from "sonner";

interface ContactSidebarProps {
  contact: Contact | null;
  onTogglePanel?: () => void;
}

export function ContactSidebar({ contact, onTogglePanel }: ContactSidebarProps) {
  // Null outside the dashboard shell (the provider lives there), which is
  // why every use below is optional rather than assumed.
  const callCenter = useCallCenter();
  const { user, accountId } = useAuth();
  /** Which half of the panel is showing. Resets to Details on a
   *  contact change — landing in someone else's team thread because
   *  that is where you were last is disorienting. */
  const [tab, setTab] = useState<'details' | 'team'>('details');
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
  // Mirrors contact.is_spam locally so the toggle reflects instantly
  // without waiting for the parent to re-fetch and pass a fresh prop.
  const [isSpam, setIsSpam] = useState(false);
  const [updatingSpam, setUpdatingSpam] = useState(false);

  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSpam(!!contact?.is_spam);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab('details');
  }, [contact]);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Deals, tags and failed messages in parallel.
    const [dealsRes, tagsRes, convsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
      supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", contact.id),
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
  }, [contact]);

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

  const handleToggleSpam = useCallback(async () => {
    if (!contact || updatingSpam) return;
    const next = !isSpam;
    setUpdatingSpam(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("contacts")
      .update({ is_spam: next })
      .eq("id", contact.id);
    setUpdatingSpam(false);
    if (error) {
      toast.error("Couldn't update spam status. Please try again.");
      return;
    }
    setIsSpam(next);
    toast.success(next ? "Contact marked as spam" : "Contact removed from spam");
  }, [contact, isSpam, updatingSpam]);

  if (!contact) {
    return (
      <div className="flex h-full w-88 flex-col border-l border-border bg-card">
        <div className="flex items-center border-b border-border px-3 py-2.5">
          {onTogglePanel && (
            <button
              type="button"
              onClick={onTogglePanel}
              aria-label="Hide contact panel"
              title="Collapse panel"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          )}
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

  return (
    <div className="flex h-full w-88 flex-col border-l border-border bg-card">
      {/* Sidebar top bar with collapse button */}
      <div className="flex items-center border-b border-border px-3 py-2.5">
        {onTogglePanel && (
          <button
            type="button"
            onClick={onTogglePanel}
            aria-label="Hide contact panel"
            title="Collapse panel"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Two views of the same contact: the record, and the team's
          conversation about them. Tabs rather than stacking the thread
          under the details — a chat needs its own height and its own
          scroll, and appending it to a long details column would put
          the composer somewhere nobody can reach without scrolling. */}
      <div
        role="tablist"
        aria-label="Contact panel"
        className="border-border flex shrink-0 border-b"
      >
        {(
          [
            ['details', 'Details'],
            ['team', 'Team Inbox'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
              if (key === 'team' && contact?.id && user?.id) {
                const storageKey = `team_thread_seen_${user.id}_${contact.id}`;
                localStorage.setItem(storageKey, new Date().toISOString());
                setUnreadTeamCount(0);
              }
            }}
            className={cn(
              'relative flex-1 px-3 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
              tab === key
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>{label}</span>
            {key === 'team' && unreadTeamCount > 0 && tab !== 'team' && (
              <span className="bg-red-500 text-white inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none animate-in fade-in zoom-in-75">
                {unreadTeamCount > 99 ? '99+' : unreadTeamCount}
              </span>
            )}
            {tab === key && (
              <span className="bg-primary absolute inset-x-3 -bottom-px h-0.5 rounded-full" />
            )}
          </button>
        ))}
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
        <div className="p-4">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center">
            {/* Same seed as the conversation list and thread header so a
                contact's colour is identical everywhere. */}
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold"
              style={{ backgroundColor: avatar.bg, color: avatar.fg }}
            >
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-xs text-muted-foreground">{contact.company}</p>
            )}
            {isSpam && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                <ShieldAlert className="h-3 w-3" />
                Marked as spam
              </span>
            )}

            <div className="mt-3 flex items-center gap-2">
              {/* Calling is WhatsApp-only and needs a number — an
                  Instagram or Messenger contact has nothing to dial. */}
              {contact.phone && callCenter && (
                <button
                  type="button"
                  onClick={() => void callCenter.placeCall(contact.phone!, displayName)}
                  disabled={callCenter.busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  Call
                </button>
              )}

              <Link
                href={`/contacts/${contact.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View contact
              </Link>
            </div>
          </div>

          {/* Phone */}
          <div className="mt-4 space-y-2">
            {contact.phone && (
              <button
                onClick={handleCopyPhone}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
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
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
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
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          {/* Calls with this contact. WhatsApp-only, so it is hidden
              entirely for a contact reached on Instagram or Messenger
              rather than showing a permanently empty section. */}
          {contact.phone && (
            <div className="mt-4">
              <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Calls
              </p>
              <ContactCallHistory contactId={contact.id} />
            </div>
          )}

          {/* Mark as Spam */}
          <button
            onClick={handleToggleSpam}
            disabled={updatingSpam}
            className={cn(
              "mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60",
              isSpam
                ? "border-border text-muted-foreground hover:bg-muted"
                : "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10",
            )}
          >
            {updatingSpam ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSpam ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            {isSpam ? "Unmark as Spam" : "Mark as Spam"}
          </button>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                <TagIcon className="h-3 w-3" />
                Tags
              </span>
              <Popover onOpenChange={(open) => !open && setTagSearch("")}>
                <PopoverTrigger className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium normal-case text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none data-popup-open:bg-muted data-popup-open:text-foreground">
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
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">No tags</p>
              ) : (
                tags.map((tag, idx) => (
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
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Active Deals */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              Active Deals
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">No deals</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg bg-muted px-3 py-2"
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
                ))
              )}
            </div>
          </div>

          {/* Recent Delivery Failures / Logs */}
          {recentFailures.length > 0 && (
            <>
              <div className="my-4 border-t border-border" />
              <div>
                <div className="flex items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-wider text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Recent Delivery Failures ({recentFailures.length})
                </div>
                <div className="mt-2 space-y-2">
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
                      <div className="mt-1.5 rounded bg-red-100/80 px-2 py-1 text-[11px] font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300 leading-snug">
                        {formatDetailedMetaError(item.error_message)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
      )}
    </div>
  );
}
