'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TemplateOption {
  id: string;
  name: string;
  language?: string;
  body_text?: string;
}

interface IntegrationConfig {
  appointment_notification_template: string | null;
  appointment_notification_enabled: boolean;
  appointment_variable_order?: string[];
}

const DEFAULT_VARIABLE_ORDER = [
  'patient_name',
  'patient_phone',
  'appointment_id',
  'appointment_date',
  'appointment_time',
  'doctor_name',
  'clinic_name',
];

export function IntegrationSetupPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [config, setConfig] = useState<IntegrationConfig>({
    appointment_notification_template: null,
    appointment_notification_enabled: false,
    appointment_variable_order: DEFAULT_VARIABLE_ORDER,
  });

  useEffect(() => {
    async function load() {
      try {
        const [templatesRes, configRes] = await Promise.all([
          fetch('/api/integrations/templates', { cache: 'no-store' }),
          fetch('/api/integrations/setup', { cache: 'no-store' }),
        ]);

        const templatesJson = await templatesRes.json();
        const configJson = await configRes.json();

        setTemplates(templatesJson.templates ?? []);
        setConfig({
          appointment_notification_template:
            configJson.config?.appointment_notification_template ?? null,
          appointment_notification_enabled: Boolean(
            configJson.config?.appointment_notification_enabled
          ),
          appointment_variable_order:
            configJson.config?.appointment_variable_order ??
            DEFAULT_VARIABLE_ORDER,
        });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/integrations/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="border-border bg-card flex h-48 items-center justify-center rounded-xl border">
        <Loader2 className="text-primary h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary rounded-full p-2">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-foreground text-lg font-semibold">
              Appointment notification setup
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Pick a Wacrm template for appointment notifications. The variables
              below will be injected automatically when your appointment app
              sends an event.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="border-border flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="enabled" className="text-sm font-medium">
                Enable appointment notifications
              </Label>
              <p className="text-muted-foreground text-sm">
                Allow appointment success events to trigger Wacrm messages.
              </p>
            </div>
            <Switch
              id="enabled"
              checked={config.appointment_notification_enabled}
              onCheckedChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  appointment_notification_enabled: value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Wacrm template</Label>
            <Select
              value={config.appointment_notification_template ?? undefined}
              onValueChange={(value) =>
                setConfig((prev) => ({
                  ...prev,
                  appointment_notification_template: value,
                }))
              }
            >
              <SelectTrigger id="template">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.name}>
                    {template.name}{' '}
                    {template.language ? `(${template.language})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Build the template inside Wacrm using the variables you want to
              inject.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="variable-order">Variable order</Label>
            <Input
              id="variable-order"
              value={(
                config.appointment_variable_order ?? DEFAULT_VARIABLE_ORDER
              ).join(',')}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  appointment_variable_order: event.target.value
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean),
                }))
              }
              placeholder="patient_name,patient_phone,appointment_id,appointment_date"
            />
            <p className="text-muted-foreground text-xs">
              Supported values: patient_name, patient_phone, appointment_id,
              appointment_date, appointment_time, doctor_name, clinic_name.
            </p>
          </div>

          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save setup
          </Button>
        </div>
      </Card>
    </div>
  );
}
