'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DEFAULT_PERSONALITY,
  PERSONALITIES,
  personalityById,
  type PersonalityId,
} from '@/lib/ai/personalities';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Maya → Personalization → Personality type: pick how she talks, and
 * read what each choice means. UI only for now — the choice isn't saved
 * or used in her replies yet.
 */
export function MayaPersonality() {
  // What's "saved" until saving exists: the default every account starts on.
  const saved = DEFAULT_PERSONALITY;
  const [selected, setSelected] = useState<PersonalityId>(saved);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const personality = personalityById(selected);

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <h3 id="maya-personality-heading" className="text-sm font-medium text-foreground">
          Personality type
        </h3>
        {selected !== saved && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Edited
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Choose the communication style, tone and response behaviour of your AI agent.
      </p>

      <Select value={selected} onValueChange={(v) => v && setSelected(v as PersonalityId)}>
        <SelectTrigger
          aria-labelledby="maya-personality-heading"
          className="mt-3 w-full bg-card data-[size=default]:h-11"
        >
          <SelectValue>{personality.name}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          {PERSONALITIES.map((p) => (
            <SelectItem key={p.id} value={p.id} className="py-2">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.summary}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        aria-expanded={detailsOpen}
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        View personality details
        <ChevronDown className={cn('size-4 transition-transform', detailsOpen && 'rotate-180')} />
      </button>

      {detailsOpen && (
        <div className="mt-3 border-t border-border pt-4">
          <p className="text-sm leading-relaxed text-foreground">{personality.description}</p>
          <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Detail label="Tone style">{personality.tone}</Detail>
            <Detail label="Response length">{personality.length}</Detail>
            <Detail label="In case of unknown info">{personality.unknownInfo}</Detail>
            <Detail label="Restrictions">
              <ul className="space-y-1">
                {personality.restrictions.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Detail>
          </dl>
        </div>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-muted-foreground">{children}</dd>
    </div>
  );
}
