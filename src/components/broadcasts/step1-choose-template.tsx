'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate } from '@/types';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const categoryColors: Record<string, string> = {
  Marketing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Utility: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Authentication: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

interface Step1Props {
  selectedTemplate: MessageTemplate | null;
  onSelect: (template: MessageTemplate) => void;
  /** Selecting a row is the whole interaction — callers that want a
   *  double-click / Enter to also confirm pass this. */
  onConfirm?: (template: MessageTemplate) => void;
}

/**
 * Pick an approved template.
 *
 * A list, not a grid. Cards put three templates across a row and gave
 * each one a body excerpt nobody reads at that size; the thing people
 * actually scan for is the name, and a list puts twice as many of those
 * on screen with the name always in the same place. The search box
 * matters more than either — an account with fifty approved templates
 * is normal, and scrolling was the only way to find one.
 */
export function Step1ChooseTemplate({
  selectedTemplate,
  onSelect,
  onConfirm,
}: Step1Props) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const supabase = createClient();
        // Only APPROVED templates can be sent via Meta — anything else
        // would 400 at broadcast time. Hide them rather than letting
        // the user pick a template that will fail.
        const { data, error: fetchError } = await supabase
          .from('message_templates')
          .select('*')
          .eq('status', 'APPROVED')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setTemplates(data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    }

    fetchTemplates();
  }, []);

  // Body text is searched as well as the name: people remember a phrase
  // from the message ("your order has shipped") far more often than
  // they remember `order_shipped_v2_utility`.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) =>
      [t.name, t.body_text, t.category, t.language ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [templates, query]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-border bg-card/50">
        <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No templates available.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create a template in Settings first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sticky so it stays reachable while the list scrolls under it —
          the dialog caps the body height, and a search box that scrolls
          away is one you have to scroll back up to correct. */}
      <div className="bg-background sticky top-0 z-10 pb-1">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            aria-label="Search templates"
            autoFocus
            className="h-10 pr-9 pl-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-1">
          <p className="text-muted-foreground text-sm">
            No templates match &ldquo;{query}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-primary text-xs font-medium hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <ul className="divide-border divide-y overflow-hidden rounded-xl border border-border">
          {filtered.map((template) => {
            const isSelected = selectedTemplate?.id === template.id;
            const catColor =
              categoryColors[template.category] ?? categoryColors.Utility;

            return (
              <li key={template.id}>
                <button
                  type="button"
                  onClick={() => onSelect(template)}
                  onDoubleClick={() => onConfirm?.(template)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors',
                    isSelected
                      ? 'bg-primary/5 ring-primary/30 ring-1 ring-inset'
                      : 'hover:bg-muted/50',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground truncate text-sm font-medium">
                        {template.name}
                      </span>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${catColor}`}
                      >
                        {template.category}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-[10px]">
                        {template.language ?? 'en_US'}
                      </span>
                    </div>
                    {/* One line, not three. In a list the body is there
                        to tell two similarly-named templates apart, not
                        to be read in full — the preview on the campaign
                        page does that job. */}
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {template.body_text}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
