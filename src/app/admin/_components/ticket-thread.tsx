'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send, Headset } from 'lucide-react';

import type { SupportTicketMessage, SupportTicketStatus } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TicketStatusBadge } from './badges';
import { fmtDateTime } from '../_lib/format';

const STATUS_ACTIONS: SupportTicketStatus[] = [
  'open',
  'pending',
  'resolved',
  'closed',
];

/**
 * The admin-side ticket conversation. "support" messages (us) are the
 * team's replies — right-aligned here — and "user" messages are the
 * customer's. Replies POST to the admin API, which inserts them with the
 * service role as author_role='support'.
 */
export function TicketThread({
  ticketId,
  initialStatus,
  initialMessages,
}: {
  ticketId: string;
  initialStatus: SupportTicketStatus;
  initialMessages: SupportTicketMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function send() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/admin/api/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Could not send reply');
        return;
      }
      setMessages((prev) => [...prev, data.message as SupportTicketMessage]);
      setReply('');
      // The API moves an 'open' ticket to 'pending' on reply — mirror it.
      if (status === 'open') setStatus('pending');
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(next: SupportTicketStatus) {
    if (next === status) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/admin/api/tickets/${ticketId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Could not update status');
        return;
      }
      setStatus(next);
      toast.success(`Ticket marked ${next}`);
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <div className="border-border bg-card flex min-h-0 flex-1 flex-col rounded-xl border">
      {/* Status bar */}
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Status</span>
          <TicketStatusBadge status={status} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_ACTIONS.map((s) => (
            <Button
              key={s}
              type="button"
              variant="outline"
              size="sm"
              disabled={updatingStatus || s === status}
              onClick={() => changeStatus(s)}
              className="border-border h-7 text-xs capitalize disabled:opacity-40"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No messages yet.
          </p>
        ) : (
          messages.map((m) => {
            const isSupport = m.author_role === 'support';
            return (
              <div
                key={m.id}
                className={cn(
                  'flex flex-col',
                  isSupport ? 'items-end' : 'items-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm',
                    isSupport
                      ? 'bg-primary-soft text-foreground rounded-tr-sm'
                      : 'bg-muted text-foreground rounded-tl-sm'
                  )}
                >
                  <p className="break-words whitespace-pre-wrap">{m.body}</p>
                </div>
                <span className="text-muted-foreground mt-1 flex items-center gap-1 px-1 text-[10px]">
                  {isSupport && <Headset className="size-3" />}
                  {isSupport ? 'You (support)' : 'Customer'} ·{' '}
                  {fmtDateTime(m.created_at)}
                </span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Reply */}
      <div className="border-border border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (reply.trim() && !sending) send();
              }
            }}
            placeholder="Reply to the customer…"
            rows={2}
            disabled={sending}
            className="border-border bg-muted text-foreground max-h-40 min-h-11 flex-1 resize-none"
          />
          <Button
            type="button"
            onClick={send}
            disabled={sending || !reply.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
