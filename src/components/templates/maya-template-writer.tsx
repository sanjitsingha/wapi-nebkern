'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { TemplateDraftResult } from '@/lib/ai/template-draft';

// ============================================================
// "Write with Maya" — the box at the top of /templates/new.
//
// The user describes the message; Maya (the account's own AI provider)
// returns a whole template and the builder fills its form with it. The
// form stays the source of truth: everything Maya wrote is editable, and
// nothing is saved or sent to Meta until the user submits as usual.
// ============================================================

const MAX_PROMPT_CHARS = 2000;

interface ErrorState {
  message: string;
  code?: string;
}

export function MayaTemplateWriter({
  language,
  onDraft,
}: {
  /** The form's current language code, used when the request names none. */
  language: string;
  onDraft: (result: TemplateDraftResult) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  async function write() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/template-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), language }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({
          message: body?.error ?? `Maya could not write the template (HTTP ${res.status})`,
          code: body?.code,
        });
        return;
      }
      setNotes(body.notes ?? []);
      onDraft(body as TemplateDraftResult);
    } catch {
      setError({ message: 'Could not reach the server. Check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Write with Maya</p>
          <p className="text-xs text-muted-foreground">
            Describe the message. Maya fills in the name, category, text,
            variables, footer and buttons for you to review.
          </p>
        </div>
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_CHARS))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            write();
          }
        }}
        placeholder="e.g. Diwali sale: 20% off every saree until 5 November. Greet the customer by name, add a button to visit shop.example.in and a quick reply to see new arrivals."
        rows={3}
        disabled={loading}
        className="bg-background border-border text-foreground placeholder:text-muted-foreground resize-y text-sm"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          Uses your AI provider from Maya settings · Ctrl+Enter to write
        </span>
        <Button
          onClick={write}
          disabled={loading || !prompt.trim()}
          className="h-9 px-3"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? 'Maya is writing…' : 'Write template'}
        </Button>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <span>{error.message}</span>
          {(error.code === 'ai_not_configured' ||
            error.code === 'invalid_key' ||
            error.code === 'output_limit') && (
            <Link href="/settings/maya" className="font-medium underline underline-offset-2">
              Open Maya settings
            </Link>
          )}
        </div>
      )}

      {notes.length > 0 && !error && (
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="text-xs font-medium text-foreground">Before you submit</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
