'use client';

import Link from 'next/link';
import { Lock, ArrowUpRight } from 'lucide-react';

import { useEntitlements } from '@/hooks/use-entitlements';
import type { PlanEntitlements } from '@/lib/billing/entitlements';

/** The boolean feature keys a gate can key off. */
export type FeatureKey =
  | 'allowCalling'
  | 'allowInstagram'
  | 'allowAutomations'
  | 'allowFlows'
  | 'allowIntegrations';

/**
 * The "this feature isn't in your plan" card with an upgrade CTA.
 * Purely presentational (no hooks), so server layouts can render it
 * directly after their own entitlement check — see the automations and
 * flows layout guards.
 */
export function FeatureLockCard({
  label,
  description,
}: {
  /** Human name shown in the lock card, e.g. "WhatsApp Calling". */
  label: string;
  /** One-liner about what the feature does. */
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Lock className="size-5" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">
        {label} isn&apos;t included in your plan
      </h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {description ??
          `Upgrade your plan to unlock ${label.toLowerCase()} for your team.`}
      </p>
      <Link
        href="/settings/profile?tab=plan"
        className="mt-5 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        View plans
        <ArrowUpRight className="size-4" />
      </Link>
    </div>
  );
}

/**
 * Wraps a feature surface and swaps it for the lock card when the
 * account's plan doesn't include the feature. While entitlements are
 * loading (or the check fails) the children render — fail open, no lock
 * flash for the common allowed case; the server routes stay the real
 * enforcement.
 */
export function FeatureGate({
  feature,
  label,
  description,
  children,
}: {
  feature: FeatureKey;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { snapshot } = useEntitlements();

  const allowed: boolean =
    snapshot === null ? true : (snapshot.entitlements as PlanEntitlements)[feature];

  if (allowed) return <>{children}</>;

  return <FeatureLockCard label={label} description={description} />;
}
