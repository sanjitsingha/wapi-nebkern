'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Send,
  MessageSquare,
  Headset,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { softBadge } from '@/lib/badge-colors';
import { cn } from '@/lib/utils';
import type {
  SupportTicket,
  SupportTicketMessage,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STATUS_BADGE: Record<SupportTicketStatus, string> = {
  open: softBadge.blue,
  pending: softBadge.amber,
  resolved: softBadge.primary,
  closed: softBadge.neutral,
};

const CATEGORY_OPTIONS: { value: SupportTicketCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical' },
  { value: 'feature', label: 'Feature request' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS: { value: SupportTicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ticketHasUnread(t: SupportTicket): boolean {
  if (!t.last_support_reply_at) return false;
  if (!t.user_last_read_at) return true;
  return Date.parse(t.last_support_reply_at) > Date.parse(t.user_last_read_at);
}

type View =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'detail'; ticketId: string };

interface SupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Support ticketing modal. Members raise tickets and hold a threaded
 * conversation with the product team. Support replies (author_role
 * 'support') are written server-side with the service role; here users
 * only read them and post their own ('user') messages. Opening a ticket
 * stamps `user_last_read_at`, which clears the sidebar's unread dot.
 */
export function SupportDialog({ open, onOpenChange }: SupportDialogProps) {
  const { user, accountId } = useAuth();

  const [view, setView] = useState<View>({ kind: 'list' });
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // New-ticket form.
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportTicketCategory>('general');
  const [priority, setPriority] = useState<SupportTicketPriority>('normal');
  const [firstMessage, setFirstMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Ticket thread.
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const loadTickets = useCallback(async () => {
    const supabase = createClient();
    // Await before the first setState so this stays out of the
    // "setState synchronously in an effect" lint trap when called on open.
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .order('updated_at', { ascending: false });
    setTickets((data ?? []) as SupportTicket[]);
    setLoadingTickets(false);
  }, []);

  // Reset to the list each time the dialog opens (adjust-state-on-open).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setView({ kind: 'list' });
  }

  useEffect(() => {
    if (open) loadTickets();
  }, [open, loadTickets]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function openTicket(ticketId: string) {
    setView({ kind: 'detail', ticketId });
    setReply('');
    setMessages([]);
    setLoadingMessages(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as SupportTicketMessage[]);
    setLoadingMessages(false);

    // Mark read for the account, then mirror locally so the row's unread
    // state updates without a refetch (realtime clears the sidebar dot).
    const readAt = new Date().toISOString();
    await supabase
      .from('support_tickets')
      .update({ user_last_read_at: readAt })
      .eq('id', ticketId);
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId ? { ...t, user_last_read_at: readAt } : t,
      ),
    );
  }

  async function createTicket() {
    if (!subject.trim() || !firstMessage.trim()) {
      toast.error('Add a subject and a message.');
      return;
    }
    if (!accountId) {
      toast.error('Your profile is not linked to an account.');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          account_id: accountId,
          user_id: user?.id ?? null,
          subject: subject.trim(),
          category,
          priority,
        })
        .select()
        .single();
      if (error || !ticket) {
        toast.error(`Could not create ticket: ${error?.message ?? 'unknown error'}`);
        return;
      }

      const { error: msgErr } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: ticket.id,
          account_id: accountId,
          author_role: 'user',
          user_id: user?.id ?? null,
          body: firstMessage.trim(),
        });
      if (msgErr) {
        toast.error(`Ticket created, but the message failed: ${msgErr.message}`);
      } else {
        toast.success('Ticket submitted — our team will reply here.');
      }

      setSubject('');
      setFirstMessage('');
      setCategory('general');
      setPriority('normal');
      await loadTickets();
      await openTicket(ticket.id as string);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply(ticketId: string) {
    if (!reply.trim()) return;
    if (!accountId) {
      toast.error('Your profile is not linked to an account.');
      return;
    }
    setSending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('support_ticket_messages').insert({
        ticket_id: ticketId,
        account_id: accountId,
        author_role: 'user',
        user_id: user?.id ?? null,
        body: reply.trim(),
      });
      if (error) {
        toast.error(`Could not send: ${error.message}`);
        return;
      }
      setReply('');
      const { data } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      setMessages((data ?? []) as SupportTicketMessage[]);
    } finally {
      setSending(false);
    }
  }

  const activeTicket =
    view.kind === 'detail'
      ? tickets.find((t) => t.id === view.ticketId) ?? null
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {/* Header */}
        <DialogHeader className="border-b border-border p-4">
          {view.kind === 'detail' ? (
            <>
              <div className="flex items-center gap-2 pr-8">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setView({ kind: 'list' })}
                  aria-label="Back to tickets"
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <DialogTitle className="min-w-0 flex-1 truncate text-popover-foreground">
                  {activeTicket?.subject ?? 'Ticket'}
                </DialogTitle>
                {activeTicket && (
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
                      STATUS_BADGE[activeTicket.status],
                    )}
                  >
                    {activeTicket.status}
                  </span>
                )}
              </div>
              <DialogDescription className="sr-only">
                Support ticket conversation
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle className="flex items-center gap-2 text-popover-foreground">
                <Headset className="size-5 text-primary" />
                {view.kind === 'new' ? 'New support ticket' : 'Support'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {view.kind === 'new'
                  ? 'Describe your issue and our team will reply right here.'
                  : 'Raise a ticket or continue a conversation with our team.'}
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {/* Body */}
        {view.kind === 'list' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-4 pt-4">
              <p className="text-sm font-medium text-foreground">Your tickets</p>
              <Button
                type="button"
                size="sm"
                onClick={() => setView({ kind: 'new' })}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="size-4" />
                New ticket
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {loadingTickets ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 text-center">
                  <MessageSquare className="mb-2 size-8 text-muted-foreground" />
                  <p className="text-sm text-foreground">No tickets yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Raise your first ticket and we’ll get back to you here.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {tickets.map((t) => {
                    const unread = ticketHasUnread(t);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => openTicket(t.id)}
                          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card/50 p-3 text-left transition-colors hover:bg-muted"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {unread && (
                                <span
                                  aria-label="Unread reply"
                                  className="size-2 shrink-0 rounded-full bg-primary"
                                />
                              )}
                              <p
                                className={cn(
                                  'truncate text-sm text-foreground',
                                  unread && 'font-semibold',
                                )}
                              >
                                {t.subject}
                              </p>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              Updated {formatWhen(t.updated_at)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize',
                              STATUS_BADGE[t.status],
                            )}
                          >
                            {t.status}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {view.kind === 'new' && (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticket-subject" className="text-foreground">
                  Subject
                </Label>
                <Input
                  id="ticket-subject"
                  value={subject}
                  maxLength={200}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of the issue"
                  disabled={submitting}
                  className="border-border bg-muted text-foreground"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-foreground">Category</Label>
                  <Select
                    value={category}
                    onValueChange={(v) =>
                      v && setCategory(v as SupportTicketCategory)
                    }
                  >
                    <SelectTrigger className="h-10 w-full border-border bg-muted">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) =>
                      v && setPriority(v as SupportTicketPriority)
                    }
                  >
                    <SelectTrigger className="h-10 w-full border-border bg-muted">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-message" className="text-foreground">
                  Message
                </Label>
                <Textarea
                  id="ticket-message"
                  value={firstMessage}
                  onChange={(e) => setFirstMessage(e.target.value)}
                  placeholder="Tell us what’s happening, and any steps to reproduce it."
                  rows={6}
                  disabled={submitting}
                  className="resize-none border-border bg-muted text-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setView({ kind: 'list' })}
                  disabled={submitting}
                  className="border-border text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={createTicket}
                  disabled={submitting || !subject.trim() || !firstMessage.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Submit ticket
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {view.kind === 'detail' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {loadingMessages ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {messages.map((m) => {
                    const isSupport = m.author_role === 'support';
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'flex flex-col',
                          isSupport ? 'items-start' : 'items-end',
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm',
                            isSupport
                              ? 'rounded-tl-sm bg-muted text-foreground'
                              : 'rounded-tr-sm bg-primary-soft text-foreground',
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        </div>
                        <span className="mt-1 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                          {isSupport && <Headset className="size-3" />}
                          {isSupport ? 'Support' : 'You'} · {formatWhen(m.created_at)}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>
              )}
            </div>

            {activeTicket && activeTicket.status === 'closed' ? (
              <div className="border-t border-border p-4 text-center text-xs text-muted-foreground">
                This ticket is closed. Raise a new ticket if you need more help.
              </div>
            ) : (
              <div className="border-t border-border p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (reply.trim() && !sending) sendReply(view.ticketId);
                      }
                    }}
                    placeholder="Write a reply…"
                    rows={2}
                    disabled={sending}
                    className="max-h-32 min-h-11 flex-1 resize-none border-border bg-muted text-foreground"
                  />
                  <Button
                    type="button"
                    onClick={() => sendReply(view.ticketId)}
                    disabled={sending || !reply.trim()}
                    className="h-11 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
