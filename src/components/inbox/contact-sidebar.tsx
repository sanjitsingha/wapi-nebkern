"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  X,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  PanelRightClose,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";

interface ContactSidebarProps {
  contact: Contact | null;
  onTogglePanel?: () => void;
}

export function ContactSidebar({ contact, onTogglePanel }: ContactSidebarProps) {
  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [savingTag, setSavingTag] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  // Mirrors contact.is_spam locally so the toggle reflects instantly
  // without waiting for the parent to re-fetch and pass a fresh prop.
  const [isSpam, setIsSpam] = useState(false);
  const [updatingSpam, setUpdatingSpam] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSpam(!!contact?.is_spam);
  }, [contact]);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, and tags in parallel
    const [dealsRes, notesRes, tagsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
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

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

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

  const displayName = contact.name || contact.phone;
  const initials = displayName.charAt(0).toUpperCase();

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
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
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

            <Link
              href={`/contacts/${contact.id}`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View contact
            </Link>
          </div>

          {/* Phone */}
          <div className="mt-4 space-y-2">
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

            {contact.email && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

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
                tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
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

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <StickyNote className="h-3 w-3" />
              Notes
            </div>
            <div className="mt-2">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
                />
                <Button
                  size="sm"
                  className="h-auto bg-primary px-2 hover:bg-primary/90"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg bg-muted px-3 py-2"
                  >
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {note.note_text}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
