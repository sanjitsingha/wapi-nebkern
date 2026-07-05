'use client';

/**
 * Flow trigger configuration — "when does this flow start?". Previously
 * lived only in the (now-removed) list view; surfaced in canvas mode via
 * a header button that opens this in a modal. Reads/writes the editor
 * state through `useFlowEditor` so it needs no props.
 */

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFlowEditor, type BuilderState } from './flow-editor-state';
import { IssueLine } from './validation-panel';

const TRIGGER_LABEL: Record<BuilderState['trigger_type'], string> = {
  keyword: 'Keyword',
  first_inbound_message: 'First message',
  manual: 'Manual',
};

/** Short, human summary of the current trigger — used on the header button. */
export function triggerSummary(state: BuilderState): string {
  if (state.trigger_type === 'keyword') {
    const kws = Array.isArray(state.trigger_config.keywords)
      ? (state.trigger_config.keywords as string[])
      : [];
    if (kws.length === 0) return 'Keyword';
    return `Keyword: ${kws.slice(0, 2).join(', ')}${kws.length > 2 ? '…' : ''}`;
  }
  return TRIGGER_LABEL[state.trigger_type];
}

// Comma-separated keyword entry. Keeps a local draft so the comma the
// user types survives until they commit (blur / Enter).
function KeywordsInput({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (keywords: string[]) => void;
}) {
  const [draft, setDraft] = useState(keywords.join(', '));
  function commit() {
    const parsed = draft
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    setDraft(parsed.join(', '));
    onChange(parsed);
  }
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
      placeholder="support, help, hi"
      className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
    />
  );
}

export function TriggerConfigForm() {
  const { state, setState, issues } = useFlowEditor();
  const triggerIssues = issues.filter((i) => i.scope === 'trigger');

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          When should this flow start?
        </label>
        <Select
          value={state.trigger_type}
          onValueChange={(v) =>
            setState((s) => ({
              ...s,
              trigger_type: v as BuilderState['trigger_type'],
              trigger_config: v === 'keyword' ? { keywords: [] } : {},
            }))
          }
        >
          <SelectTrigger className="w-full border-border bg-muted text-foreground data-[size=default]:h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-border bg-popover">
            <SelectItem value="keyword">A message contains a keyword</SelectItem>
            <SelectItem value="first_inbound_message">
              Customer&apos;s first ever inbound message
            </SelectItem>
            <SelectItem value="manual">Manual only (no auto-trigger)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {state.trigger_type === 'keyword' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Keywords (comma-separated)
          </label>
          <KeywordsInput
            keywords={
              Array.isArray(state.trigger_config.keywords)
                ? (state.trigger_config.keywords as string[])
                : []
            }
            onChange={(keywords) =>
              setState((s) => ({
                ...s,
                trigger_config: { ...s.trigger_config, keywords },
              }))
            }
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            The flow starts when an inbound message contains any of these words.
          </p>
        </div>
      )}

      {state.trigger_type === 'first_inbound_message' && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Starts the first time a brand-new contact ever messages you.
        </p>
      )}

      {state.trigger_type === 'manual' && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Won&apos;t auto-start — assign it to a conversation from the inbox&apos;s
          Assign → Bot menu.
        </p>
      )}

      {triggerIssues.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          {triggerIssues.map((i, ix) => (
            <IssueLine key={ix} issue={i} />
          ))}
        </div>
      )}
    </div>
  );
}
