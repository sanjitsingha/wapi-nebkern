// The lifecycle stages Settings offers for people who arrive by
// messaging. Client-safe (the settings page renders the list), so it
// lives apart from the push worker that sets them.

export type LifecycleStage =
  | 'subscriber'
  | 'lead'
  | 'marketingqualifiedlead'
  | 'salesqualifiedlead';

export const LIFECYCLE_STAGES: { value: LifecycleStage; label: string }[] = [
  { value: 'subscriber', label: 'Subscriber' },
  { value: 'lead', label: 'Lead' },
  { value: 'marketingqualifiedlead', label: 'Marketing qualified lead' },
  { value: 'salesqualifiedlead', label: 'Sales qualified lead' },
];

export function isLifecycleStage(v: unknown): v is LifecycleStage {
  return LIFECYCLE_STAGES.some((s) => s.value === v);
}
