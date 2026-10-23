'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useCan } from '@/hooks/use-can';
import {
  ACTIVATION_PROMPT_MAX_CHARS,
  DEFAULT_ACTIVATION_PROMPT,
} from '@/lib/ai/reply-settings';
import { Button } from '@/components/ui/button';
import { InfoHint } from '@/components/ui/info-hint';
import { PromptEditor } from './prompt-editor';

type Mode = 'auto' | 'manual';

/** Chat activation mode, as `auto_reply_enabled`: auto = true. */
const MODES: { value: Mode; title: string; body: string }[] = [
  {
    value: 'auto',
    title: 'Auto-activate for all chats',
    body: 'Maya replies in every conversation. You can stop her in any single chat from the inbox.',
  },
  {
    value: 'manual',
    title: 'Manual activation per chat',
    body: 'Maya stays quiet by default. Assign a chat to the AI agent in the inbox to have her reply there.',
  },
];

interface Saved {
  configured: boolean;
  isActive: boolean;
  mode: Mode;
  /** null = no rules saved; she answers every message she's allowed to. */
  rules: string | null;
}

/**
 * Maya → Activation: when she replies. Activation rules (which
 * messages need an answer) and chat activation mode (every chat, or
 * only chats assigned to her). Both save through PATCH /api/ai/config.
 */
export function MayaActivationSettings() {
  const canEdit = useCan('edit-settings');
  const [saved, setSaved] = useState<Saved | null>(null);
  const [rules, setRules] = useState('');
  const [mode, setMode] = useState<Mode>('auto');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/config');
      const data = await res.json().catch(() => ({}));
      const next: Saved = {
        configured: !!data?.configured,
        isActive: data?.is_active === true,
        mode: data?.auto_reply_enabled === true ? 'auto' : 'manual',
        rules: typeof data?.activation_prompt === 'string' ? data.activation_prompt : null,
      };
      setSaved(next);
      setMode(next.mode);
      // No rules yet: start the editor on the suggested ones. They only
      // take effect once saved — the note below says so.
      setRules(next.rules ?? DEFAULT_ACTIVATION_PROMPT);
    } catch {
      toast.error('Could not load Maya’s configuration.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!saved) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  // Editable before Dripo's AI is ready: PATCH creates the row, and
  // the rules apply once she can answer.
  const locked = !canEdit;
  const tooLong = rules.trim().length > ACTIVATION_PROMPT_MAX_CHARS;
  const rulesChanged = rules.trim() !== (saved.rules ?? '').trim();
  const dirty = rulesChanged || mode !== saved.mode;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_reply_enabled: mode === 'auto',
          activation_prompt: rules.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not save the configuration.');
        return;
      }
      toast.success('Configuration saved.');
      await load();
    } catch {
      toast.error('Could not reach Dripo. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const rulesNote = !rules.trim()
    ? 'No rules — Maya replies to every message.'
    : saved.rules === null
      ? 'Not in use yet — Maya replies to every message until you save these rules.'
      : null;

  return (
    <div className="space-y-4">
      {!saved.configured && (
        <Notice>
          Maya isn&apos;t available yet — AI is still being set up for Dripo. You can set
          these now; they apply once she&apos;s ready.
        </Notice>
      )}
      {saved.configured && !saved.isActive && (
        <Notice>
          Maya is switched off, so none of this applies until you turn her on in{' '}
          <Link href="/askmaya" className="font-medium underline underline-offset-2">
            Overview
          </Link>
          .
        </Notice>
      )}
      {!canEdit && (
        <p className="text-sm text-muted-foreground">Only admins can change these settings.</p>
      )}

      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        {/* Activation rules */}
        <section aria-labelledby="maya-rules-heading">
          <h3 id="maya-rules-heading" className="text-sm font-medium text-foreground">
            Customize activation rules
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Fine-tune when Maya should respond. She checks each new message against these
            rules before she writes a reply.
          </p>

          <div className="mt-3">
            <PromptEditor
              value={rules}
              onChange={setRules}
              disabled={locked}
              labelledBy="maya-rules-heading"
              maxChars={ACTIVATION_PROMPT_MAX_CHARS}
              editorTitle="Activation rules"
              editorDescription="Maya checks each new message against these rules before she replies."
              footerActions={
                rules.trim() !== DEFAULT_ACTIVATION_PROMPT && (
                  <button
                    type="button"
                    onClick={() => setRules(DEFAULT_ACTIVATION_PROMPT)}
                    disabled={locked}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
                  >
                    Use suggested rules
                  </button>
                )
              }
            />
          </div>
          {rulesNote && <p className="mt-2 text-xs text-muted-foreground">{rulesNote}</p>}
        </section>

        <hr className="my-6 border-border" />

        {/* Chat activation mode */}
        <section aria-labelledby="maya-mode-heading">
          <div className="flex items-center gap-1.5">
            <h3 id="maya-mode-heading" className="text-sm font-medium text-foreground">
              Chat activation mode
            </h3>
            <InfoHint label="Chat activation mode" docs="/docs/ai-agents">
              Which chats Maya answers. In either mode she stands back when a teammate is
              assigned to the chat, and hands over when she can&rsquo;t help.
            </InfoHint>
          </div>
          <div role="radiogroup" aria-labelledby="maya-mode-heading" className="mt-3 space-y-3">
            {MODES.map((m) => {
              const selected = mode === m.value;
              return (
                <label
                  key={m.value}
                  className={cn(
                    'flex gap-3 rounded-lg border p-4 transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring',
                    selected ? 'border-primary bg-primary/5' : 'border-border',
                    locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted/40',
                  )}
                >
                  <input
                    type="radio"
                    name="maya-activation-mode"
                    value={m.value}
                    checked={selected}
                    disabled={locked}
                    onChange={() => setMode(m.value)}
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{m.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {m.body}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <div className="mt-6 flex justify-end border-t border-border pt-4">
          <Button onClick={save} disabled={locked || !dirty || tooLong || saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>

    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
