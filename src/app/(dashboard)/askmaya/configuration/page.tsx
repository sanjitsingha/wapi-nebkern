import { MayaActivationSettings } from '@/components/agents/maya-activation-settings';
import { MayaOperationalSettings } from '@/components/agents/maya-operational-settings';
import { SettingsPanelHead } from '@/components/settings/settings-panel-head';

export default function MayaConfigurationPage() {
  return (
    <section>
      <SettingsPanelHead title="Activation" description="How and when Maya replies." />
      <div className="space-y-6">
        <MayaActivationSettings />
        <MayaOperationalSettings />
      </div>
    </section>
  );
}
