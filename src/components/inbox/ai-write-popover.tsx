'use client';

import { useRef, useState } from 'react';
import { Check, Loader2, RefreshCw, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ============================================================
// The composer's ✨ "Write with Maya": a panel above the message box where
// the agent says what to write ("ask for their delivery address"),
// Generate writes it right there, and a tick — or Enter — puts it in
// the message box to send. Editing the prompt after a message is ready
// turns the tick back into Generate, to write it again.
//
// /api/ai/draft takes the prompt as the business's own instruction and
// writes in the context of the conversation; left empty it writes the
// best next reply.
// ============================================================

type Phase = 'prompt' | 'writing' | 'ready' | 'error';

export function AiWritePopover({
  conversationId,
  disabled,
  onInsert,
}: {
  conversationId: string;
  disabled?: boolean;
  /** Put the message in the composer's box. */
  onInsert: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  /** The prompt the shown message was written for. */
  const [resultFor, setResultFor] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('prompt');
  const [error, setError] = useState('');
  // A message that arrives after the panel closed, or after a newer
  // Generate, is dropped.
  const request = useRef(0);

  const reset = () => {
    request.current += 1;
    setPrompt('');
    setResult('');
    setResultFor(null);
    setPhase('prompt');
    setError('');
  };

  const generate = async () => {
    const id = ++request.current;
    const instruction = prompt.trim();
    setPhase('writing');
    setError('');
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          ...(instruction ? { instruction } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { draft?: string; error?: string };
      if (id !== request.current) return;
      if (!res.ok || typeof data.draft !== 'string' || !data.draft.trim()) {
        setError(data.error ?? "Couldn't write a message.");
        setPhase('error');
        return;
      }
      setResult(data.draft.trim());
      setResultFor(instruction);
      setPhase('ready');
    } catch {
      if (id === request.current) {
        setError("Couldn't reach the AI assistant.");
        setPhase('error');
      }
    }
  };

  const accept = () => {
    const text = result.trim();
    if (!text) return;
    onInsert(text);
    setOpen(false);
    reset();
  };

  // The tick stands in for Generate only while the message shown is the
  // one this prompt asked for.
  const canAccept = phase === 'ready' && resultFor === prompt.trim() && !!result.trim();
  const primary = () => (canAccept ? accept() : void generate());

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger
        disabled={disabled}
        title="Write with Maya"
        aria-label="Write with Maya"
        className="text-primary hover:bg-primary-soft/60 data-popup-open:bg-primary-soft/60 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md p-0 transition-colors disabled:opacity-50"
      >
        <Sparkles className="h-[18px] w-[18px]" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[34rem] max-w-[calc(100vw-2rem)] gap-3 p-4"
      >
        <p className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="text-primary size-4" />
          Write with Maya
        </p>

        {/* One box: the prompt, with its button inside at the bottom
            right — Generate, then "Use this" once a draft is ready. */}
        <div className="border-border bg-background focus-within:border-primary/50 rounded-lg border transition-colors">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (phase !== 'writing') primary();
              }
            }}
            placeholder="Tell Maya what to write…"
            aria-label="What to write"
            maxLength={500}
            rows={3}
            autoFocus
            disabled={phase === 'writing'}
            className="text-foreground placeholder:text-muted-foreground block min-h-20 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-sm leading-relaxed outline-none disabled:opacity-60"
          />
          <div className="flex justify-end px-2 pb-2">
            {canAccept ? (
              <Button
                type="button"
                size="sm"
                onClick={accept}
                title="Put this in the message box"
                className="h-8"
              >
                <Check className="size-4" />
                Use this
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => void generate()}
                disabled={phase === 'writing'}
                className="h-8"
              >
                {phase === 'writing' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Generate
              </Button>
            )}
          </div>
        </div>

        {phase === 'writing' && (
          <div className="border-border bg-muted/40 space-y-2 rounded-lg border p-3">
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Loader2 className="size-3.5 animate-spin" />
              Maya is writing…
            </span>
            <div className="bg-muted h-2.5 w-full animate-pulse rounded" />
            <div className="bg-muted h-2.5 w-11/12 animate-pulse rounded" />
            <div className="bg-muted h-2.5 w-4/5 animate-pulse rounded" />
            <div className="bg-muted h-2.5 w-3/5 animate-pulse rounded" />
          </div>
        )}

        {phase === 'error' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
            <button
              type="button"
              onClick={() => void generate()}
              className="mt-2 flex items-center gap-1 font-medium underline-offset-2 hover:underline"
            >
              <RefreshCw className="size-3" />
              Try again
            </button>
          </div>
        )}

        {phase === 'ready' && (
          <textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            onKeyDown={(e) => {
              // Enter puts it in the message box; Shift+Enter is a new line.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                accept();
              }
            }}
            rows={8}
            className="border-border bg-muted/40 text-foreground focus:border-primary/50 w-full resize-none rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none"
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
