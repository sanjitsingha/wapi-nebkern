import { Clock } from 'lucide-react';

/**
 * The "this channel isn't available yet" placeholder.
 *
 * Deliberately parallel to FeatureLockCard (components/billing/
 * feature-gate.tsx) but with no upgrade CTA — a shelved channel isn't
 * something a plan can unlock, so offering "View plans" here would sell
 * something we can't deliver.
 *
 * Purely presentational and hook-free, so both server and client
 * section pages can render it directly.
 */
export function ComingSoonCard({
  label,
  description,
}: {
  /** Human name of the channel, e.g. "Messenger". */
  label: string;
  /** One-liner about what it will do once it ships. */
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Clock className="size-5" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">
        {label} is coming soon
      </h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {description ??
          `We're still building the ${label} channel. It'll show up here once it's ready.`}
      </p>
    </div>
  );
}
