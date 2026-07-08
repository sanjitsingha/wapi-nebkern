'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import type { Contact, Tag, ContactNote, CustomField, Deal, Message } from '@/types';
import {
  ContactMedia,
  ContactLinks,
  extractLinks,
  filterMedia,
  type LinkItem,
} from '@/components/contacts/contact-media';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Phone,
  Mail,
  Building2,
  MapPin,
  Copy,
  Check,
  Loader2,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  DollarSign,
  User,
  Tag as TagIcon,
  StickyNote,
  SlidersHorizontal,
  Briefcase,
  History,
  UserPlus,
  Search,
  X,
  Image as ImageIcon,
  Link as LinkIcon,
  MoreVertical,
  BellOff,
  Bell,
  ShieldAlert,
  ShieldCheck,
  Ban,
  CircleCheck,
} from 'lucide-react';

const TABS = [
  { value: 'details', label: 'Details', icon: User },
  { value: 'timeline', label: 'Timeline', icon: History },
  { value: 'notes', label: 'Notes', icon: StickyNote },
  { value: 'media', label: 'Media', icon: ImageIcon },
  { value: 'links', label: 'Links', icon: LinkIcon },
  { value: 'custom', label: 'Custom Fields', icon: SlidersHorizontal },
  { value: 'deals', label: 'Deals', icon: Briefcase },
] as const;

function getInitials(name?: string | null) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

const STATUS_TONES = {
  red: 'border-red-500/30 bg-red-500/10 text-red-600',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  muted: 'border-border bg-muted text-muted-foreground',
} as const;

function StatusBadge({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof Ban;
  label: string;
  tone: keyof typeof STATUS_TONES;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_TONES[tone]}`}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const contactId = params.id;
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editLocality, setEditLocality] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editPinCode, setEditPinCode] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [tagSearch, setTagSearch] = useState('');

  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [savingCustom, setSavingCustom] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(false);

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const [mediaMessages, setMediaMessages] = useState<Message[]>([]);
  const [linkItems, setLinkItems] = useState<LinkItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const fetchContact = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('contacts').select('*').eq('id', contactId).single();
    if (data) {
      setContact(data);
      setEditName(data.name ?? '');
      setEditPhone(data.phone);
      setEditEmail(data.email ?? '');
      setEditCompany(data.company ?? '');
      setEditStreet(data.street ?? '');
      setEditLocality(data.locality ?? '');
      setEditCity(data.city ?? '');
      setEditState(data.state ?? '');
      setEditPinCode(data.pin_code ?? '');
    }
    setLoading(false);
  }, [contactId, supabase]);

  const fetchTags = useCallback(async () => {
    const [tagsRes, contactTagsRes] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase.from('contact_tags').select('tag_id').eq('contact_id', contactId),
    ]);
    if (tagsRes.data) setAllTags(tagsRes.data);
    if (contactTagsRes.data) setContactTagIds(contactTagsRes.data.map((ct) => ct.tag_id));
  }, [contactId, supabase]);

  const fetchNotes = useCallback(async () => {
    setLoadingNotes(true);
    const { data } = await supabase
      .from('contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    if (data) setNotes(data);
    setLoadingNotes(false);
  }, [contactId, supabase]);

  const fetchCustomFields = useCallback(async () => {
    setLoadingCustom(true);
    const [fieldsRes, valuesRes] = await Promise.all([
      supabase.from('custom_fields').select('*').order('field_name'),
      supabase.from('contact_custom_values').select('*').eq('contact_id', contactId),
    ]);
    if (fieldsRes.data) setCustomFields(fieldsRes.data);
    if (valuesRes.data) {
      const map: Record<string, string> = {};
      valuesRes.data.forEach((v) => { map[v.custom_field_id] = v.value ?? ''; });
      setCustomValues(map);
    }
    setLoadingCustom(false);
  }, [contactId, supabase]);

  const fetchDeals = useCallback(async () => {
    setLoadingDeals(true);
    const { data } = await supabase
      .from('deals')
      .select('*, stage:pipeline_stages(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setDeals((data ?? []) as Deal[]);
    setLoadingDeals(false);
  }, [contactId, supabase]);

  // Media + links live in this contact's message history. Resolve the
  // contact's conversations first, then pull their messages once and
  // split them into shared media and extracted links (both newest-first).
  const fetchMediaLinks = useCallback(async () => {
    setLoadingMedia(true);
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId);
    const convIds = (convs ?? []).map((c) => c.id);
    if (convIds.length === 0) {
      setMediaMessages([]);
      setLinkItems([]);
      setLoadingMedia(false);
      return;
    }
    const { data } = await supabase
      .from('messages')
      .select(
        'id, conversation_id, sender_type, content_type, content_text, media_url, status, created_at',
      )
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false });
    const messages = (data ?? []) as Message[];
    setMediaMessages(filterMedia(messages));
    setLinkItems(extractLinks(messages));
    setLoadingMedia(false);
  }, [contactId, supabase]);

  useEffect(() => {
    fetchContact();
    fetchTags();
    fetchNotes();
    fetchCustomFields();
    fetchDeals();
    fetchMediaLinks();
  }, [fetchContact, fetchTags, fetchNotes, fetchCustomFields, fetchDeals, fetchMediaLinks]);

  async function copyPhone() {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  async function saveDetails() {
    if (!editPhone.trim()) { toast.error('Phone number is required'); return; }
    setSavingDetails(true);
    const { error } = await supabase.from('contacts').update({
      name: editName.trim() || null,
      phone: editPhone.trim(),
      email: editEmail.trim() || null,
      company: editCompany.trim() || null,
      street: editStreet.trim() || null,
      locality: editLocality.trim() || null,
      city: editCity.trim() || null,
      state: editState.trim() || null,
      pin_code: editPinCode.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', contactId);
    if (error) { toast.error('Failed to update contact'); }
    else { toast.success('Contact updated'); fetchContact(); }
    setSavingDetails(false);
  }

  // Toggle a boolean status flag (is_muted / is_spam / is_blocked) on
  // the contact. Optimistic — flips local state immediately, rolls back
  // on error. `updatingStatus` guards against overlapping clicks.
  const [updatingStatus, setUpdatingStatus] = useState(false);
  async function toggleStatus(
    field: 'is_muted' | 'is_spam' | 'is_blocked',
    labels: { on: string; off: string },
  ) {
    if (!contact || updatingStatus) return;
    const next = !contact[field];
    setUpdatingStatus(true);
    setContact({ ...contact, [field]: next });
    const { error } = await supabase
      .from('contacts')
      .update({ [field]: next, updated_at: new Date().toISOString() })
      .eq('id', contactId);
    setUpdatingStatus(false);
    if (error) {
      setContact({ ...contact, [field]: !next }); // roll back
      toast.error('Failed to update contact');
      return;
    }
    toast.success(next ? labels.on : labels.off);
  }

  async function toggleTag(tagId: string) {
    setSavingTags(true);
    const isSelected = contactTagIds.includes(tagId);
    if (isSelected) {
      const { error } = await supabase.from('contact_tags').delete().eq('contact_id', contactId).eq('tag_id', tagId);
      if (!error) setContactTagIds((prev) => prev.filter((id) => id !== tagId));
    } else {
      const { error } = await supabase.from('contact_tags').insert({ contact_id: contactId, tag_id: tagId });
      if (!error) setContactTagIds((prev) => [...prev, tagId]);
    }
    setSavingTags(false);
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user || !accountId) { toast.error('Not authenticated'); setSavingNote(false); return; }
    const { error } = await supabase.from('contact_notes').insert({
      contact_id: contactId,
      account_id: accountId,
      user_id: user.id,
      note_text: newNote.trim(),
    });
    if (error) { toast.error('Failed to add note'); }
    else { setNewNote(''); fetchNotes(); toast.success('Note added'); }
    setSavingNote(false);
  }

  async function deleteNote(noteId: string) {
    const { error } = await supabase.from('contact_notes').delete().eq('id', noteId);
    if (error) { toast.error('Failed to delete note'); }
    else { setNotes((prev) => prev.filter((n) => n.id !== noteId)); toast.success('Note deleted'); }
  }

  async function saveCustomFields() {
    setSavingCustom(true);
    try {
      await supabase.from('contact_custom_values').delete().eq('contact_id', contactId);
      const rows = Object.entries(customValues)
        .filter(([, val]) => val.trim())
        .map(([fieldId, val]) => ({ contact_id: contactId, custom_field_id: fieldId, value: val.trim() }));
      if (rows.length > 0) {
        const { error } = await supabase.from('contact_custom_values').insert(rows);
        if (error) throw error;
      }
      toast.success('Custom fields saved');
    } catch { toast.error('Failed to save custom fields'); }
    setSavingCustom(false);
  }

  // Merge the data we already fetch (contact creation, notes, deals) into
  // a single reverse-chronological activity feed. Derived — no extra query.
  // Declared before the early returns below so hook order stays stable.
  const timelineEvents = useMemo(() => {
    const events: {
      id: string;
      icon: typeof StickyNote;
      iconClass: string;
      title: string;
      detail?: string;
      date: string;
    }[] = [];

    if (contact) {
      events.push({
        id: `created-${contact.id}`,
        icon: UserPlus,
        iconClass: 'bg-primary/10 text-primary',
        title: 'Contact created',
        date: contact.created_at,
      });
    }
    notes.forEach((n) =>
      events.push({
        id: `note-${n.id}`,
        icon: StickyNote,
        iconClass: 'bg-amber-500/10 text-amber-600',
        title: 'Note added',
        detail: n.note_text,
        date: n.created_at,
      }),
    );
    deals.forEach((d) =>
      events.push({
        id: `deal-${d.id}`,
        icon: Briefcase,
        iconClass: 'bg-blue-500/10 text-blue-600',
        title: `Deal created — ${d.title}`,
        detail: formatCurrency(d.value ?? 0, d.currency || defaultCurrency),
        date: d.created_at,
      }),
    );

    return events.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [contact, notes, deals, defaultCurrency]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <p className="text-sm text-muted-foreground">Contact not found.</p>
        <Button variant="outline" onClick={() => router.push('/contacts')}>
          <ArrowLeft className="size-4" /> Back to Contacts
        </Button>
      </div>
    );
  }

  const activeTags = allTags.filter((t) => contactTagIds.includes(t.id));
  const filteredTags = allTags.filter((t) =>
    t.name.toLowerCase().includes(tagSearch.trim().toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        type="button"
        onClick={() => router.push('/contacts')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Contacts
      </button>

      {/* Profile header card */}
      <div className="relative rounded-xl border border-border bg-card p-6">
        {/* Actions menu — top right */}
        <div className="absolute right-4 top-4">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Contact actions"
              className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none data-popup-open:bg-muted data-popup-open:text-foreground"
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() =>
                  toggleStatus('is_muted', {
                    on: 'Contact muted',
                    off: 'Contact unmuted',
                  })
                }
                disabled={updatingStatus}
              >
                {contact.is_muted ? (
                  <>
                    <Bell className="size-4" /> Unmute
                  </>
                ) : (
                  <>
                    <BellOff className="size-4" /> Mute
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  toggleStatus('is_spam', {
                    on: 'Reported as spam',
                    off: 'Removed from spam',
                  })
                }
                disabled={updatingStatus}
              >
                {contact.is_spam ? (
                  <>
                    <ShieldCheck className="size-4" /> Not spam
                  </>
                ) : (
                  <>
                    <ShieldAlert className="size-4" /> Report spam
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant={contact.is_blocked ? 'default' : 'destructive'}
                onClick={() =>
                  toggleStatus('is_blocked', {
                    on: 'Contact blocked',
                    off: 'Contact unblocked',
                  })
                }
                disabled={updatingStatus}
              >
                {contact.is_blocked ? (
                  <>
                    <CircleCheck className="size-4" /> Unblock
                  </>
                ) : (
                  <>
                    <Ban className="size-4" /> Block
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar className="size-16 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
              {getInitials(contact.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 pr-10 sm:pr-12">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold text-foreground">
                {contact.name || 'Unknown'}
              </h1>
              {contact.is_blocked && (
                <StatusBadge icon={Ban} label="Blocked" tone="red" />
              )}
              {contact.is_spam && (
                <StatusBadge icon={ShieldAlert} label="Spam" tone="amber" />
              )}
              {contact.is_muted && (
                <StatusBadge icon={BellOff} label="Muted" tone="muted" />
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={copyPhone}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Phone className="size-3.5" />
                {contact.phone}
                {copiedPhone ? (
                  <Check className="size-3.5 text-primary" />
                ) : (
                  <Copy className="size-3.5 opacity-60" />
                )}
              </button>
              {contact.email && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Mail className="size-3.5" /> {contact.email}
                </span>
              )}
              {contact.company && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Building2 className="size-3.5" /> {contact.company}
                </span>
              )}
            </div>

            {/* Tags — active pills + inline "add tag" popover */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {activeTags.map((tag) => (
                <span
                  key={tag.id}
                  className="group/tag inline-flex items-center gap-1.5 rounded-full border py-1 pl-2 pr-1 text-[11px] font-medium"
                  style={{
                    borderColor: tag.color + '55',
                    backgroundColor: tag.color + '14',
                    color: tag.color,
                  }}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    disabled={savingTags}
                    aria-label={`Remove ${tag.name}`}
                    className="flex size-4 items-center justify-center rounded-full opacity-50 transition-opacity hover:bg-black/10 hover:opacity-100 disabled:opacity-40"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}

              <Popover onOpenChange={(open) => !open && setTagSearch('')}>
                <PopoverTrigger className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-transparent py-1 pl-2 pr-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus:outline-none data-popup-open:border-primary/50 data-popup-open:text-primary">
                  <TagIcon className="size-3" />
                  Add tag
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 gap-0 p-0">
                  {allTags.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No tags yet.
                      <br />
                      Create tags in Settings.
                    </p>
                  ) : (
                    <>
                      <div className="border-b border-border p-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={tagSearch}
                            onChange={(e) => setTagSearch(e.target.value)}
                            placeholder="Search tags…"
                            autoFocus
                            className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto p-1">
                        {filteredTags.length === 0 ? (
                          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                            No tags found.
                          </p>
                        ) : (
                          filteredTags.map((tag) => {
                            const active = contactTagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => toggleTag(tag.id)}
                                disabled={savingTags}
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
                          })
                        )}
                      </div>
                    </>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList
          variant="line"
          className="h-auto w-full flex-wrap justify-start gap-x-8 gap-y-2 border-b border-border pb-0"
        >
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-none gap-1.5 px-1 py-2.5 text-foreground/60 data-active:text-primary data-active:after:bg-primary"
            >
              <Icon className="size-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Details */}
        <TabsContent value="details" className="mt-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-5 text-sm font-semibold text-foreground">Contact details</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="bg-background border-border text-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Phone <span className="text-destructive">*</span></Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="bg-background border-border text-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Email</Label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                  className="bg-background border-border text-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Company</Label>
                <Input value={editCompany} onChange={(e) => setEditCompany(e.target.value)}
                  className="bg-background border-border text-foreground" />
              </div>
            </div>

            {/* Address */}
            <div className="mt-8 mb-5 flex items-center gap-2 border-t border-border pt-6">
              <MapPin className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Address</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3 xl:col-span-4">
                <Label className="text-muted-foreground text-xs">Street</Label>
                <Input value={editStreet} onChange={(e) => setEditStreet(e.target.value)}
                  placeholder="House / building, street"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Locality</Label>
                <Input value={editLocality} onChange={(e) => setEditLocality(e.target.value)}
                  placeholder="Area / locality"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">City</Label>
                <Input value={editCity} onChange={(e) => setEditCity(e.target.value)}
                  className="bg-background border-border text-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">State</Label>
                <Input value={editState} onChange={(e) => setEditState(e.target.value)}
                  className="bg-background border-border text-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Pin Code</Label>
                <Input value={editPinCode} onChange={(e) => setEditPinCode(e.target.value)}
                  inputMode="numeric"
                  className="bg-background border-border text-foreground" />
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-border pt-5">
              <Button onClick={saveDetails} disabled={savingDetails}
                className="bg-primary hover:bg-primary-hover text-primary-foreground">
                {savingDetails ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Changes
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-5 text-sm font-semibold text-foreground">Activity timeline</h2>
            {timelineEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                No activity yet.
              </div>
            ) : (
              <ol className="relative space-y-6">
                {/* Vertical rail */}
                <span
                  aria-hidden
                  className="absolute left-[15px] top-2 bottom-2 w-px bg-border"
                />
                {timelineEvents.map((event) => {
                  const Icon = event.icon;
                  return (
                    <li key={event.id} className="relative flex gap-4">
                      <span
                        className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card ${event.iconClass}`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <p className="text-sm font-medium text-foreground">{event.title}</p>
                          <time className="text-xs text-muted-foreground">
                            {new Date(event.date).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </time>
                        </div>
                        {event.detail && (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                            {event.detail}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-6">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a note..."
                className="bg-background border-border text-foreground placeholder:text-muted-foreground min-h-[80px] resize-none" />
              <div className="mt-3 flex justify-end">
                <Button onClick={addNote} disabled={!newNote.trim() || savingNote}
                  className="bg-primary hover:bg-primary-hover text-primary-foreground">
                  {savingNote ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Add Note
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {loadingNotes ? (
                <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              ) : notes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">No notes yet.</div>
              ) : notes.map((note) => (
                <div key={note.id} className="group rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 whitespace-pre-wrap text-sm text-foreground">{note.note_text}</p>
                    <button onClick={() => deleteNote(note.id)}
                      className="shrink-0 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(note.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Media */}
        <TabsContent value="media" className="mt-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-5 text-sm font-semibold text-foreground">
              Shared media
            </h2>
            <ContactMedia items={mediaMessages} loading={loadingMedia} />
          </div>
        </TabsContent>

        {/* Links */}
        <TabsContent value="links" className="mt-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-5 text-sm font-semibold text-foreground">
              Shared links
            </h2>
            <ContactLinks items={linkItems} loading={loadingMedia} />
          </div>
        </TabsContent>

        {/* Custom Fields */}
        <TabsContent value="custom" className="mt-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-5 text-sm font-semibold text-foreground">Custom fields</h2>
            {loadingCustom ? (
              <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
            ) : customFields.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No custom fields defined. Create them in Settings.</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {customFields.map((field) => (
                    <div key={field.id} className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs capitalize">{field.field_name}</Label>
                      <Input
                        value={customValues[field.id] ?? ''}
                        onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        placeholder={`Enter ${field.field_name}...`}
                        className="bg-background border-border text-foreground placeholder:text-muted-foreground" />
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end border-t border-border pt-5">
                  <Button onClick={saveCustomFields} disabled={savingCustom}
                    className="bg-primary hover:bg-primary-hover text-primary-foreground">
                    {savingCustom ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save Custom Fields
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Deals */}
        <TabsContent value="deals" className="mt-6">
          {loadingDeals ? (
            <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-primary" /></div>
          ) : deals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">No deals yet.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {deals.map((deal) => (
                <div key={deal.id} className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{deal.title}</p>
                    {deal.stage && (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: `${deal.stage.color}20`, color: deal.stage.color }}>
                        {deal.stage.name}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <DollarSign className="size-3.5 text-muted-foreground" />
                      {formatCurrency(deal.value ?? 0, deal.currency || defaultCurrency)}
                    </span>
                    {deal.status && deal.status !== 'open' && (
                      <span className={`capitalize ${deal.status === 'won' ? 'text-primary' : 'text-red-600'}`}>
                        {deal.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
