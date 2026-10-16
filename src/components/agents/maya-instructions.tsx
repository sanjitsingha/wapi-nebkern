'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { FileText, ScrollText, ShieldAlert, Sparkles, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { PromptEditor } from './prompt-editor';

/** Filled in by "Use template" on the Restrictions card. */
const RESTRICTIONS_TEMPLATE = `<restrictions>
- Don't discuss competitors or compare us with other products.
- Don't promise discounts, refunds or delivery dates that aren't in the knowledge base.
- Don't give legal, medical or financial advice.
- Don't share internal processes, staff names or contact details unless they're in the knowledge base.
- Never ask for payment details, passwords or one-time codes.
- If a customer is upset or asks for a person, hand the chat to a teammate.
</restrictions>`;

/**
 * Maya → Personalization: her role and instructions, and what she must
 * not do. UI only for now — nothing here is saved or used in her
 * replies yet.
 */
export function MayaInstructions() {
  const [role, setRole] = useState('');
  const [restrictions, setRestrictions] = useState('');

  function applyTemplate() {
    if (
      restrictions.trim() &&
      !window.confirm('Replace what you have written with the template?')
    ) {
      return;
    }
    setRestrictions(RESTRICTIONS_TEMPLATE);
  }

  return (
    <div className="space-y-6">
      <MayaCard
        icon={ScrollText}
        iconClassName="bg-emerald-50 text-emerald-700"
        title="Agent role and instructions"
        titleId="maya-role-heading"
        description="Give instructions to the AI agent and define its role."
        action={
          <PillButton
            icon={Sparkles}
            className="bg-violet-100 text-violet-700 hover:bg-violet-200"
            onClick={() => toast.message('Improve with AI is coming soon.')}
          >
            Improve with AI
          </PillButton>
        }
      >
        <PromptEditor
          value={role}
          onChange={setRole}
          rows={10}
          labelledBy="maya-role-heading"
          placeholder={
            'Tell Maya about your business and her job. For example:\n\n<company_overview>\nWhat you sell, who your customers are, where you operate.\n</company_overview>\n\n<agent_identity_and_role>\nWho Maya is, what she helps customers with, and how she should sound.\n</agent_identity_and_role>'
          }
          editorTitle="Agent role and instructions"
          editorDescription="Who Maya is, what she knows about your business, and how she should help."
        />
      </MayaCard>

      <MayaCard
        icon={ShieldAlert}
        iconClassName="bg-muted text-muted-foreground"
        title="Restrictions"
        titleId="maya-restrictions-heading"
        badge="Optional"
        description="Set boundaries for the AI."
        action={
          <PillButton
            icon={FileText}
            className="bg-blue-50 text-blue-700 hover:bg-blue-100"
            onClick={applyTemplate}
          >
            Use template
          </PillButton>
        }
      >
        <PromptEditor
          value={restrictions}
          onChange={setRestrictions}
          rows={8}
          labelledBy="maya-restrictions-heading"
          placeholder="Specific topics or actions the AI should avoid…"
          editorTitle="Restrictions"
          editorDescription="Topics and actions Maya should stay away from."
        />
      </MayaCard>
    </div>
  );
}

function MayaCard({
  icon: Icon,
  iconClassName,
  title,
  titleId,
  badge,
  description,
  action,
  children,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  titleId: string;
  badge?: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={titleId} className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', iconClassName)}>
            <Icon className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 id={titleId} className="text-base font-semibold text-foreground">
                {title}
              </h3>
              {badge && (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {badge}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PillButton({
  icon: Icon,
  className,
  onClick,
  children,
}: {
  icon: LucideIcon;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
        className,
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}
