'use client';

import { useRef, useState } from 'react';
import { Loader2, RefreshCw, Send, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ============================================================
// "Reply with AI" on one incoming message: the ✨ on the bubble opens a
// panel beside it — like the emoji panel — where the AI writes a reply
// to exactly that message. It can be edited there and sent from there,
// as a reply quoting the message. Nothing touches the composer.
//
// The draft comes from /api/ai/draft with the message's id, which ends
// the transcript at that message and searches the knowledge base with
// its words.
// ============================================================

type Phase =
  | { kind: 'idle' }
  | { kind: 'writing' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

export function AiReplyPopover({
  conversationId,
  messageId,
  blockedReason,
  onSend,
}: {
  conversationId: string;
  messageId: string;
  /** Why a reply cannot be sent right now (e.g. WhatsApp's 24-hour
   *  window has closed) — shown instead of writing one. */
  blockedReason?: string | null;
  /** Send the text as a reply to this message. */
  onSend: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [text, setText] = useState('');
  // Each open writes afresh; a reply that lands after the panel closed
  // (or after a newer request) is dropped.
  const request = useRef(0);

  const write = async () => {
    const id = ++request.current;
    setPhase({ kind: 'writing' });
    setText('');
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, message_id: messageId }),
      });
      const data = (await res.json().catch(() => ({}))) as { draft?: string; error?: string };
      if (id !== request.current) return;
      if (!res.ok || typeof data.draft !== 'string' || !data.draft.trim()) {
        setPhase({ kind: 'error', message: data.error ?? "Couldn't write a reply." });
        return;
      }
      setText(data.draft.trim());
      setPhase({ kind: 'ready' });
    } catch {
      if (id === request.current) {
        setPhase({ kind: 'error', message: "Couldn't reach the AI assistant." });
      }
    }
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      if (!blockedReason) void write();
    } else {
      request.current += 1;
      setPhase({ kind: 'idle' });
      setText('');
    }
  };

  const send = () => {
    const reply = text.trim();
    if (!reply) return;
    onSend(reply);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        title="Reply with AI"
        aria-label="Reply with AI"
        className="text-primary hover:bg-primary-soft data-popup-open:bg-primary-soft -my-0.5 flex size-5 shrink-0 items-center justify-center rounded-full transition-colors"
      >
        <Sparkles className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={10} className="w-80 gap-2.5 p-3">
        <p className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles className="text-primary size-3.5" />
          Reply with AI
        </p>

        {blockedReason ? (
          <p className="text-muted-foreground text-xs leading-relaxed">{blockedReason}</p>
        ) : phase.kind === 'writing' ? (
          <div className="border-border bg-muted/40 space-y-2 rounded-lg border p-3">
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Loader2 className="size-3.5 animate-spin" />
              Writing a reply…
            </span>
            <div className="bg-muted h-2.5 w-full animate-pulse rounded" />
            <div className="bg-muted h-2.5 w-4/5 animate-pulse rounded" />
            <div className="bg-muted h-2.5 w-3/5 animate-pulse rounded" />
          </div>
        ) : phase.kind === 'error' ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {phase.message}
            <button
              type="button"
              onClick={() => void write()}
              className="mt-2 flex items-center gap-1 font-medium underline-offset-2 hover:underline"
            >
              <RefreshCw className="size-3" />
              Try again
            </button>
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl/⌘+Enter sends; plain Enter is a new line, as in a note.
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            autoFocus
            rows={5}
            className="border-border bg-background text-foreground focus:border-primary/50 w-full resize-none rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none"
          />
        )}

        {!blockedReason && (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={send}
              disabled={phase.kind !== 'ready' || !text.trim()}
            >
              <Send className="size-3.5" />
              Send
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
