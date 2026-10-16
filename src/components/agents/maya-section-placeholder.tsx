import { SettingsPanelHead } from '@/components/settings/settings-panel-head';

/**
 * A Maya page that exists in her side panel but has nothing on it yet:
 * the page's heading and an empty area where its controls will go.
 */
export function MayaSectionPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section>
      <SettingsPanelHead title={title} description={description} />
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Coming soon
      </div>
    </section>
  );
}
