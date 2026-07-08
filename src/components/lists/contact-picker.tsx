'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CreatedAtFilterDialog } from '@/components/contacts/created-at-filter-dialog';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { Contact, Tag } from '@/types';

type ContactWithTags = Contact & { tags: Tag[] };

function formatDateLabel(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function nextDayISO(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface ContactPickerProps {
  /** Fetches contacts+tags whenever this flips to true (mirrors a
   *  dialog's `open` prop) so the picker starts fresh each time it's
   *  shown rather than holding a stale contact list in the background. */
  open: boolean;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  /** Contacts already in the list — hidden from the picker entirely
   *  so they can't be "added" a second time (add-existing-contacts
   *  flow). Omit for the create-list flow, where nothing is excluded. */
  excludeContactIds?: Set<string>;
}

/**
 * Search + tag-filter + created-at-filter contact multi-select, used
 * by both the create-list modal and the add-existing-contacts dialog.
 * Renders the filter bar and scrollable contact list only — the
 * caller supplies the surrounding Dialog/header/footer.
 */
export function ContactPicker({
  open,
  selectedIds,
  onSelectedIdsChange,
  excludeContactIds,
}: ContactPickerProps) {
  const supabase = createClient();
  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function loadData() {
      setLoading(true);
      const [contactsRes, tagsRes] = await Promise.all([
        supabase
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('tags').select('*').order('name'),
      ]);

      const contactRows = (contactsRes.data as Contact[]) ?? [];
      const tagRows = (tagsRes.data as Tag[]) ?? [];
      setTags(tagRows);

      if (contactRows.length === 0) {
        setContacts([]);
        setLoading(false);
        return;
      }

      const tagsById: Record<string, Tag> = {};
      tagRows.forEach((tag) => {
        tagsById[tag.id] = tag;
      });

      const { data: contactTags } = await supabase
        .from('contact_tags')
        .select('contact_id, tag_id')
        .in(
          'contact_id',
          contactRows.map((c) => c.id)
        );

      const tagIdsByContact: Record<string, string[]> = {};
      contactTags?.forEach((ct) => {
        (tagIdsByContact[ct.contact_id] ??= []).push(ct.tag_id);
      });

      setContacts(
        contactRows.map((contact) => ({
          ...contact,
          tags: (tagIdsByContact[contact.id] ?? [])
            .map((tagId) => tagsById[tagId])
            .filter(Boolean),
        }))
      );
      setLoading(false);
    }

    loadData();
  }, [open, supabase]);

  // Every open starts filters fresh — a stale search/tag/date filter
  // from a previous use shouldn't silently hide contacts next time.
  useEffect(() => {
    if (open) return;
    setSearch('');
    setSelectedTagIds([]);
    setCreatedFrom('');
    setCreatedTo('');
  }, [open]);

  const availableContacts = useMemo(
    () =>
      excludeContactIds
        ? contacts.filter((c) => !excludeContactIds.has(c.id))
        : contacts,
    [contacts, excludeContactIds]
  );

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return availableContacts.filter((contact) => {
      const matchesSearch =
        !term ||
        [contact.name, contact.phone, contact.email, contact.company]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);

      const matchesTags =
        selectedTagIds.length === 0 ||
        contact.tags.some((tag) => selectedTagIds.includes(tag.id));

      const matchesCreatedFrom =
        !createdFrom || contact.created_at >= createdFrom;
      const matchesCreatedTo =
        !createdTo || contact.created_at < nextDayISO(createdTo);

      return (
        matchesSearch && matchesTags && matchesCreatedFrom && matchesCreatedTo
      );
    });
  }, [availableContacts, createdFrom, createdTo, search, selectedTagIds]);

  const toggleContact = (id: string) => {
    onSelectedIdsChange(
      selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id]
    );
  };

  const toggleTagFilter = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const hasDateFilter = createdFrom !== '' || createdTo !== '';
  const hasFilters =
    search !== '' || selectedTagIds.length > 0 || hasDateFilter;

  const clearFilters = () => {
    setSearch('');
    setSelectedTagIds([]);
    setCreatedFrom('');
    setCreatedTo('');
  };

  const allVisibleSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((contact) => selectedIds.includes(contact.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(filteredContacts.map((c) => c.id));
      onSelectedIdsChange(selectedIds.filter((id) => !visibleIds.has(id)));
      return;
    }
    const next = new Set(selectedIds);
    filteredContacts.forEach((c) => next.add(c.id));
    onSelectedIdsChange(Array.from(next));
  };

  return (
    <>
      <div className="shrink-0 border-b border-border px-6 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="h-9 pl-8 text-sm"
            />
          </div>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 border-border text-muted-foreground hover:bg-muted"
                />
              }
            >
              <Filter className="size-3.5" />
              Tags
              {selectedTagIds.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {selectedTagIds.length}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-sm font-medium text-popover-foreground">
                  Filter by tags
                </span>
                {selectedTagIds.length > 0 && (
                  <button
                    onClick={() => setSelectedTagIds([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              {tags.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No tags yet.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto py-1">
                  {tags.map((tag) => (
                    <label
                      key={tag.id}
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedTagIds.includes(tag.id)}
                        onCheckedChange={() => toggleTagFilter(tag.id)}
                      />
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="truncate text-sm text-popover-foreground">
                        {tag.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDateFilterOpen(true)}
            className={cn(
              'h-9 shrink-0 border-border hover:bg-muted',
              hasDateFilter
                ? 'border-primary/40 text-primary'
                : 'text-muted-foreground'
            )}
          >
            <CalendarDays className="size-3.5" />
            {hasDateFilter
              ? `${createdFrom ? formatDateLabel(createdFrom) : 'Any'} – ${createdTo ? formatDateLabel(createdTo) : 'Any'}`
              : 'Created at'}
          </Button>

          <div className="text-xs text-muted-foreground sm:ml-auto">
            {filteredContacts.length} of {availableContacts.length} contacts
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="ml-2 text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">
            Loading contacts...
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
            <p className="text-sm font-medium text-foreground">
              No contacts match your filters
            </p>
            <p className="text-xs text-muted-foreground">
              Try a different search term or clear filters.
            </p>
          </div>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-3 border-b border-border bg-muted/30 px-6 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleSelectAllVisible}
              />
              Select all visible
            </label>
            <div className="divide-y divide-border">
              {filteredContacts.map((contact) => {
                const initials = (contact.name || contact.phone || '?')
                  .charAt(0)
                  .toUpperCase();

                return (
                  <label
                    key={contact.id}
                    className="flex cursor-pointer items-center gap-3 px-6 py-2.5 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedIds.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                    />
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
                      {contact.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={contact.avatar_url}
                          alt={contact.name || contact.phone || "Contact"}
                          className="size-9 rounded-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {contact.name || contact.phone}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {contact.phone}
                      </p>
                    </div>
                    {contact.tags.length > 0 && (
                      <div className="hidden shrink-0 items-center gap-1 sm:flex">
                        {contact.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                        {contact.tags.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{contact.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>

      <CreatedAtFilterDialog
        open={dateFilterOpen}
        onOpenChange={setDateFilterOpen}
        appliedFrom={createdFrom}
        appliedTo={createdTo}
        onApply={(from, to) => {
          setCreatedFrom(from);
          setCreatedTo(to);
        }}
      />
    </>
  );
}
