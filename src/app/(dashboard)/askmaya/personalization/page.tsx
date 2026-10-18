'use client';

import { Loader2 } from 'lucide-react';

import { useCan } from '@/hooks/use-can';
import { MayaInstructions } from '@/components/agents/maya-instructions';
import { MayaPersonality } from '@/components/agents/maya-personality';
import { useMayaConfig } from '@/components/agents/use-maya-config';
import { SettingsPanelHead } from '@/components/settings/settings-panel-head';

/** Maya → Personalization: how she talks, who she is, what she won't do. */
export default function MayaPersonalizationPage() {
  const canEdit = useCan('edit-settings');
  const { config, failed, save } = useMayaConfig();

  return (
    <section>
      <SettingsPanelHead
        title="Personalization"
        description="Her personality, her role and instructions, and what she must not do."
      />
      {failed ? (
        <p className="text-sm text-muted-foreground">Couldn&apos;t load Maya&apos;s settings. Refresh to try again.</p>
      ) : !config ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {!canEdit && (
            <p className="text-sm text-muted-foreground">Only admins can change these settings.</p>
          )}
          <MayaPersonality
            saved={config.personality}
            disabled={!canEdit}
            onSave={(personality) => save({ personality })}
          />
          <MayaInstructions
            savedRole={config.system_prompt ?? ''}
            savedRestrictions={config.restrictions ?? ''}
            disabled={!canEdit}
            onSave={save}
          />
        </div>
      )}
    </section>
  );
}
