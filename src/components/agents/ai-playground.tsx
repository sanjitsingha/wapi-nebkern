'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Bot,
  RotateCcw,
  Send,
  UserRound,
  ArrowRight,
  UserCircle2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  /** assistant-only: the agent signalled a human handoff on this turn. */
  handoff?: boolean;
}

const SUGGESTIONS = [
  'Hi, what are your opening hours?',
  'Do you ship internationally?',
  "I'd like a refund on my order",
  'Can I speak to a human?',
];

export function AiPlayground({
  onGoToSetup,
  subtitle,
  configured = true,
}: {
  onGoToSetup?: () => void;
  /** e.g. "OpenRouter · deepseek/…:free" — shown under the agent name. */
  subtitle?: string;
  configured?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [turns, sending]);

  // Auto-grow the composer up to a few lines.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [input]);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || sending) return;

    const next: Turn[] = [...turns, { role: 'user', content: text }];
    setTurns(next);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/ai/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'ai_not_configured') {
          toast.error('No agent configured yet — finish Setup first.');
        } else {
          toast.error(data.error ?? "Couldn't get a reply.");
        }
        setTurns(turns);
        setInput(text);
        return;
      }
      setTurns([
        ...next,
        {
          role: 'assistant',
          content:
            typeof data.reply === 'string' && data.reply.trim()
              ? data.reply
              : '',
          handoff: Boolean(data.handoff),
        },
      ]);
    } catch {
      toast.error("Couldn't reach the agent.");
      setTurns(turns);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex h-[65vh] min-h-[460px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Header — agent identity */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative">
            <span className="flex size-9 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
              <Bot className="h-5 w-5" />
            </span>
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card',
                configured ? 'bg-emerald-500' : 'bg-muted-foreground/50',
              )}
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">
              Your agent
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {configured
                ? (subtitle ?? 'Ready to chat')
                : 'Not configured yet'}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTurns([])}
          disabled={turns.length === 0 || sending}
          className="text-muted-foreground"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
        </Button>
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-5 [scrollbar-width:thin]"
      >
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Sparkles className="h-7 w-7" />
            </span>
            <p className="mt-4 text-sm font-medium text-foreground">
              Test your agent like a customer would
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Send a message and see how it replies — using your business context
              and handing off to a human when it can&apos;t safely help. Nothing
              here touches WhatsApp.
            </p>

            {configured ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/40 hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              onGoToSetup && (
                <Button size="sm" onClick={onGoToSetup} className="mt-5">
                  Finish setup <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )
            )}
          </div>
        ) : (
          turns.map((t, i) => (
            <div
              key={i}
              className={cn(
                'flex items-end gap-2',
                t.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {t.role === 'assistant' && (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div
                className={cn(
                  'max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                  t.role === 'user'
                    ? 'rounded-br-md bg-primary text-primary-foreground'
                    : 'rounded-bl-md border border-border bg-background text-foreground',
                )}
              >
                {t.content && (
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {t.content}
                  </p>
                )}
                {t.role === 'assistant' && t.handoff && (
                  <p
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400',
                      t.content && 'mt-2 border-t border-border/60 pt-2',
                    )}
                  >
                    <UserCircle2 className="h-3.5 w-3.5" />
                    Would hand off to a human here
                  </p>
                )}
              </div>
              {t.role === 'user' && (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <UserRound className="h-4 w-4" />
                </span>
              )}
            </div>
          ))
        )}

        {sending && (
          <div className="flex items-end gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-background px-4 py-3">
              <Dot delay="0ms" />
              <Dot delay="150ms" />
              <Dot delay="300ms" />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-muted/20 p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-1.5 pl-3 transition-colors focus-within:border-primary/50">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a customer message…"
            rows={1}
            className="max-h-[140px] flex-1 resize-none self-center bg-transparent py-1.5 text-sm text-foreground placeholder-muted-foreground outline-none"
          />
          <Button
            size="sm"
            onClick={() => void send()}
            disabled={!input.trim() || sending}
            className="size-9 shrink-0 rounded-xl p-0"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          Press <kbd className="font-sans font-medium">Enter</kbd> to send,{' '}
          <kbd className="font-sans font-medium">Shift+Enter</kbd> for a new line.
        </p>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDelay: delay }}
    />
  );
}
