'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useCan } from '@/hooks/use-can';
import {
  RESPONSE_DELAY,
  SNOOZE,
  WEEKDAYS,
  WEEKDAY_LABELS,
  defaultOperatingHours,
  parseOperatingHours,
  parseSeconds,
  type OperatingHours,
  type Weekday,
} from '@/lib/ai/reply-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { InfoHint } from '@/components/ui/info-hint';

interface Saved {
  locked: boolean;
  delay: string;
  snooze: string;
  maxReplies: string;
  hours: OperatingHours;
}

/** Auto-replies per conversation (PATCH /api/ai/config's 1–20). */
const MAX_REPLIES = { min: 1, max: 20, default: 3 };

function parseMaxReplies(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= MAX_REPLIES.min && n <= MAX_REPLIES.max ? n : null;
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Every IANA zone the browser knows, with `current` always included. */
function timezoneOptions(current: string): string[] {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf?.('timeZone');
  const zones = supported && supported.length > 0 ? supported : [current];
  return zones.includes(current) ? zones : [current, ...zones];
}

/**
 * Maya → Activation → Operational settings: how long she waits before
 * replying, how long she stays quiet after a teammate replies, how many
 * replies she may send in one conversation (once on the old Settings
 * page), and the hours she works. Saves through PATCH /api/ai/config.
 */
export function MayaOperationalSettings() {
  const canEdit = useCan('edit-settings');
  const [saved, setSaved] = useState<Saved | null>(null);
  const [delay, setDelay] = useState('');
  const [snooze, setSnooze] = useState('');
  const [maxReplies, setMaxReplies] = useState('');
  const [hours, setHours] = useState<OperatingHours>(() => defaultOperatingHours(browserTimezone()));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/config');
      const data = await res.json().catch(() => ({}));
      const next: Saved = {
        // Editable before Dripo's AI is ready — PATCH creates the row.
        locked: false,
        delay: String(data?.response_delay_seconds ?? RESPONSE_DELAY.default),
        snooze: String(data?.snooze_seconds ?? SNOOZE.default),
        maxReplies: String(data?.auto_reply_max_per_conversation ?? MAX_REPLIES.default),
        hours: parseOperatingHours(data?.operating_hours) ?? defaultOperatingHours(browserTimezone()),
      };
      setSaved(next);
      setDelay(next.delay);
      setSnooze(next.snooze);
      setMaxReplies(next.maxReplies);
      setHours(next.hours);
    } catch {
      toast.error('Could not load Maya’s operational settings.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const zones = useMemo(() => timezoneOptions(hours.timezone), [hours.timezone]);

  if (!saved) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  const locked = saved.locked || !canEdit;
  const delayValue = parseSeconds(delay, RESPONSE_DELAY);
  const snoozeValue = parseSeconds(snooze, SNOOZE);
  const maxRepliesValue = parseMaxReplies(maxReplies);
  const hoursValid = parseOperatingHours(hours) !== null;
  const dirty =
    delay !== saved.delay ||
    snooze !== saved.snooze ||
    maxReplies !== saved.maxReplies ||
    JSON.stringify(hours) !== JSON.stringify(saved.hours);
  const valid = delayValue !== null && snoozeValue !== null && maxRepliesValue !== null && hoursValid;

  function setDay(day: Weekday, value: OperatingHours['days'][Weekday]) {
    setHours((h) => ({ ...h, days: { ...h.days, [day]: value } }));
  }

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_delay_seconds: delayValue,
          snooze_seconds: snoozeValue,
          auto_reply_max_per_conversation: maxRepliesValue,
          operating_hours: hours,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not save the operational settings.');
        return;
      }
      toast.success('Operational settings saved.');
      await load();
    } catch {
      toast.error('Could not reach Dripo. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h3 className="text-base font-semibold text-foreground">Operational settings</h3>

      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <SecondsField
          id="maya-response-delay"
          label="Response delay"
          hint="Maya waits this long after the customer’s last message before she replies. If a teammate answers in the meantime, she stays quiet."
          description="How long Maya waits before actually sending a response. This gives your team time to reply manually first."
          value={delay}
          onChange={setDelay}
          range={RESPONSE_DELAY}
          invalid={delayValue === null}
          disabled={locked}
        />
        <SecondsField
          id="maya-snooze"
          label="Snooze duration"
          hint="After a teammate sends a message in a chat, Maya won't reply there for this long. 0 means no pause."
          description="When a teammate responds, how long Maya pauses before she can activate again. This keeps her from interrupting a conversation a person is having."
          value={snooze}
          onChange={setSnooze}
          range={SNOOZE}
          invalid={snoozeValue === null}
          disabled={locked}
        />
        <SecondsField
          id="maya-max-replies"
          label="Replies per conversation"
          hint="After this many automatic replies in one conversation, Maya goes quiet there and leaves it to your team."
          description="The most automatic replies Maya sends in one conversation before leaving it to your team."
          value={maxReplies}
          onChange={setMaxReplies}
          range={MAX_REPLIES}
          unit="replies"
          invalid={maxRepliesValue === null}
          disabled={locked}
        />
      </div>

      <hr className="my-6 border-border" />

      <div className="flex items-start gap-4">
        <Switch
          checked={hours.enabled}
          onCheckedChange={(enabled) => setHours((h) => ({ ...h, enabled }))}
          disabled={locked}
          aria-labelledby="maya-hours-heading"
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span id="maya-hours-heading" className="text-sm font-medium text-foreground">
              Operating hours
            </span>
            <InfoHint label="Operating hours" docs="/docs/ai-agents">
              Outside these hours a customer&rsquo;s message waits for your team — Maya
              doesn&rsquo;t answer it later either.
            </InfoHint>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Define specific hours when Maya should be active. Outside these hours she won&rsquo;t
            respond automatically, even if the activation criteria are met.
          </p>

          {hours.enabled && (
            <div className="mt-4 space-y-3">
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Timezone</span>
                <select
                  value={hours.timezone}
                  onChange={(e) => setHours((h) => ({ ...h, timezone: e.target.value }))}
                  disabled={locked}
                  className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground"
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>

              <div className="divide-y divide-border rounded-lg border border-border">
                {WEEKDAYS.map((day) => {
                  const open = hours.days[day];
                  const badRange = open !== null && open.end <= open.start;
                  return (
                    <div key={day} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                      <label className="flex w-32 items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={open !== null}
                          disabled={locked}
                          onChange={(e) =>
                            setDay(day, e.target.checked ? { start: '09:00', end: '18:00' } : null)
                          }
                          className="size-4 accent-primary"
                        />
                        {WEEKDAY_LABELS[day]}
                      </label>
                      {open ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Input
                            type="time"
                            value={open.start}
                            disabled={locked}
                            onChange={(e) => setDay(day, { ...open, start: e.target.value })}
                            aria-label={`${WEEKDAY_LABELS[day]} opens`}
                            className={cn('h-9 w-28', badRange && 'border-red-500')}
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={open.end}
                            disabled={locked}
                            onChange={(e) => setDay(day, { ...open, end: e.target.value })}
                            aria-label={`${WEEKDAY_LABELS[day]} closes`}
                            className={cn('h-9 w-28', badRange && 'border-red-500')}
                          />
                          {badRange && <span className="text-xs text-red-700">End after start</span>}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end border-t border-border pt-4">
        <Button onClick={save} disabled={locked || !dirty || !valid || saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}

function SecondsField({
  id,
  label,
  hint,
  description,
  value,
  onChange,
  range,
  unit = 'seconds',
  invalid,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  range: { min: number; max: number };
  /** What the number counts — seconds unless said otherwise. */
  unit?: string;
  invalid: boolean;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <InfoHint label={label} docs="/docs/ai-agents">
          {hint}
        </InfoHint>
      </div>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-3 flex items-center gap-3">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={range.min}
          max={range.max}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          className={cn('h-10 w-24', invalid && 'border-red-500')}
        />
        <span className="text-sm text-muted-foreground">
          {unit}{' '}
          <span className={cn(invalid && 'text-red-700')}>
            ({range.min}–{range.max} {unit})
          </span>
        </span>
      </div>
    </div>
  );
}
