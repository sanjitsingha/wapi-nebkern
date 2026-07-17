'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send, Headset } from 'lucide-react';

import type {
  SupportTicketMessage,
  SupportTicketStatus,
} from '@/types';
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
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status</span>
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
              className="h-7 border-border text-xs capitalize disabled:opacity-40"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
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
                  isSupport ? 'items-end' : 'items-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm',
                    isSupport
                      ? 'rounded-tr-sm bg-primary-soft text-foreground'
                      : 'rounded-tl-sm bg-muted text-foreground',
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
                <span className="mt-1 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
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
      <div className="border-t border-border p-3">
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
            className="max-h-40 min-h-11 flex-1 resize-none border-border bg-muted text-foreground"
          />
          <Button
            type="button"
            onClick={send}
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
    </div>
  );
}
