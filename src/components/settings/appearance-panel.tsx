"use client";

import { SettingsPanelHead } from "./settings-panel-head";

export function AppearancePanel() {
  return (
    <section className="max-w-3xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="Appearance"
        description="The app uses a fixed light theme. No customisation is available."
      />
    </section>
  );
}
