import { MayaInstructions } from '@/components/agents/maya-instructions';
import { MayaPersonality } from '@/components/agents/maya-personality';
import { SettingsPanelHead } from '@/components/settings/settings-panel-head';

export default function MayaPersonalizationPage() {
  return (
    <section>
      <SettingsPanelHead title="Personalization" description="Maya's name, tone and greeting." />
      <div className="space-y-6">
        <MayaPersonality />
        <MayaInstructions />
      </div>
    </section>
  );
}
