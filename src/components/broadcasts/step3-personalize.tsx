'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Contact, CustomField, MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Eye, Loader2 } from 'lucide-react';

type VariableType = 'static' | 'field' | 'custom_field';

interface VariableMapping {
  type: VariableType;
  value: string;
}

interface Step3Props {
  template: MessageTemplate;
  variables: Record<string, VariableMapping>;
  onUpdate: (variables: Record<string, VariableMapping>) => void;
  onNext?: () => void;
  onBack?: () => void;
  embedded?: boolean;
}

const contactFields = [
  { value: 'name', label: 'Contact Name' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'email', label: 'Email Address' },
  { value: 'company', label: 'Company' },
];

const SAMPLE_CONTACT: Contact = {
  id: 'sample',
  user_id: '',
  account_id: '',
  name: 'John Doe',
  phone: '+1234567890',
  email: 'john@example.com',
  company: 'Acme Corp',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function Step3Personalize({
  template,
  variables,
  onUpdate,
  onNext,
  onBack,
  embedded = false,
}: Step3Props) {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [firstContact, setFirstContact] = useState<Contact | null>(null);
  const [firstContactCustomValues, setFirstContactCustomValues] = useState<
    Map<string, string>
  >(new Map());
  const [loadingPreview, setLoadingPreview] = useState(true);

  // Load user's custom fields + a representative contact for the
  // live preview. Fall back to sample data if no contacts exist yet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [fieldsRes, contactRes] = await Promise.all([
        supabase.from('custom_fields').select('*').order('field_name'),
        supabase
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      setCustomFields(fieldsRes.data ?? []);
      setLoadingFields(false);

      const contact = contactRes.data ?? null;
      setFirstContact(contact);

      if (contact) {
        const { data: customVals } = await supabase
          .from('contact_custom_values')
          .select('custom_field_id, value')
          .eq('contact_id', contact.id);
        if (!cancelled) {
          const map = new Map<string, string>();
          for (const row of customVals ?? []) {
            map.set(row.custom_field_id, row.value ?? '');
          }
          setFirstContactCustomValues(map);
        }
      }
      setLoadingPreview(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const placeholders = useMemo(() => {
    const matches = template.body_text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches)].sort();
  }, [template.body_text]);

  /**
   * A placeholder is "unmapped" if the user hasn't picked either a
   * static value or a field/custom-field source. Blocks Next until
   * every placeholder has something — otherwise the broadcast would
   * ship with empty strings and confuse recipients.
   */
  const unmappedKeys = useMemo(() => {
    const missing: string[] = [];
    for (const placeholder of placeholders) {
      const key = placeholder.replace(/^\{\{|\}\}$/g, '');
      const mapping = variables[key];
      if (!mapping || !mapping.value?.trim()) {
        missing.push(placeholder);
      }
    }
    return missing;
  }, [placeholders, variables]);

  function updateVariable(key: string, patch: Partial<VariableMapping>) {
    const current = variables[key] ?? { type: 'static' as VariableType, value: '' };
    onUpdate({
      ...variables,
      [key]: { ...current, ...patch },
    });
  }

  /**
   * Substitute placeholders using the first real contact where
   * possible. Placeholders keyed by "{{N}}" map to variable key "N".
   */
  const previewText = useMemo(() => {
    const contact = firstContact ?? SAMPLE_CONTACT;
    const customValues = firstContact
      ? firstContactCustomValues
      : new Map<string, string>();

    let text = template.body_text;
    for (const placeholder of placeholders) {
      const key = placeholder.replace(/^\{\{|\}\}$/g, '');
      const mapping = variables[key];
      let replacement = placeholder;

      if (mapping) {
        if (mapping.type === 'static' && mapping.value) {
          replacement = mapping.value;
        } else if (mapping.type === 'field' && mapping.value) {
          const fieldMap: Record<string, string | undefined> = {
            name: contact.name,
            phone: contact.phone ?? undefined,
            email: contact.email,
            company: contact.company,
          };
          replacement = fieldMap[mapping.value] ?? placeholder;
        } else if (mapping.type === 'custom_field' && mapping.value) {
          replacement = customValues.get(mapping.value) || placeholder;
        }
      }
      text = text.replaceAll(placeholder, replacement);
    }
    return text;
  }, [
    template.body_text,
    variables,
    placeholders,
    firstContact,
    firstContactCustomValues,
  ]);

  const previewLabel = firstContact
    ? firstContact.name || firstContact.phone
    : 'sample data';

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">Personalize Message</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Map template variables to contact fields, custom fields, or static
            values.
          </p>
        </div>
      )}

      {placeholders.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            This template has no variables to personalize.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {placeholders.map((placeholder) => {
            const key = placeholder.replace(/^\{\{|\}\}$/g, '');
            const mapping = variables[key] ?? { type: 'static', value: '' };

            return (
              <div
                key={placeholder}
                className="rounded-xl border border-border bg-card/50 p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-mono font-medium text-primary">
                    {placeholder}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Mapping Type
                    </label>
                    <Select
                      value={mapping.type}
                      onValueChange={(val) =>
                        updateVariable(key, {
                          type: val as VariableType,
                          value: '',
                        })
                      }
                    >
                      <SelectTrigger className="w-full border-border bg-muted text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-popover">
                        <SelectItem value="static">Static Value</SelectItem>
                        <SelectItem value="field">Contact Field</SelectItem>
                        <SelectItem value="custom_field">
                          Custom Field
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {mapping.type === 'static' ? 'Value' : 'Field'}
                    </label>
                    {mapping.type === 'static' ? (
                      <Input
                        value={mapping.value}
                        onChange={(e) =>
                          updateVariable(key, { value: e.target.value })
                        }
                        placeholder="Enter value..."
                        className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
                      />
                    ) : mapping.type === 'field' ? (
                      <Select
                        value={mapping.value || undefined}
                        onValueChange={(val) =>
                          updateVariable(key, { value: val || '' })
                        }
                      >
                        <SelectTrigger className="w-full border-border bg-muted text-foreground">
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-popover">
                          {contactFields.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        value={mapping.value || undefined}
                        onValueChange={(val) =>
                          updateVariable(key, { value: val || '' })
                        }
                      >
                        <SelectTrigger className="w-full border-border bg-muted text-foreground">
                          <SelectValue
                            placeholder={
                              loadingFields
                                ? 'Loading…'
                                : customFields.length === 0
                                  ? 'No custom fields'
                                  : 'Select custom field…'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-popover">
                          {customFields.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.field_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!embedded && (
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-foreground">Live Preview</p>
            <span className="text-xs text-muted-foreground">({previewLabel})</span>
            {loadingPreview && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            )}
          </div>
          <div className="rounded-lg bg-[#0e1a12] p-3">
            <div className="ml-auto max-w-[85%] rounded-lg bg-primary/30 px-3 py-2 shadow-sm">
              <p className="whitespace-pre-wrap text-sm text-primary">
                {previewText}
              </p>
            </div>
          </div>
        </div>
      )}

      {unmappedKeys.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Map every placeholder before continuing — still missing{' '}
          <span className="font-mono font-semibold">
            {unmappedKeys.join(', ')}
          </span>
          . Otherwise those placeholders will ship to Meta as empty strings.
        </div>
      )}

      {!embedded && onBack && onNext && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button
            variant="outline"
            onClick={onBack}
            className="border-border text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={onNext}
            disabled={unmappedKeys.length > 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
