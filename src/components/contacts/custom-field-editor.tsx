'use client';

import { cn } from '@/lib/utils';
import { dropdownOptions, fieldTypeOf } from '@/lib/contacts/custom-field-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CustomField } from '@/types';

/** What a dropdown shows for "nothing chosen" — not a storable value. */
const NONE = '__none__';

/**
 * One custom field on a contact: its name (a red ✱ when it's mandatory)
 * and the input its type calls for — a text box, a number box, a date
 * picker or a dropdown of its options. Used by the contact slide-over
 * and the contact page alike.
 */
export function CustomFieldEditor({
  field,
  value,
  onChange,
  inputClassName,
}: {
  field: CustomField;
  value: string;
  onChange: (value: string) => void;
  inputClassName?: string;
}) {
  const id = `cf-${field.id}`;
  const type = fieldTypeOf(field.field_type);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {field.field_name}
        {field.is_required && (
          <span className="text-red-600 dark:text-red-400" aria-label="mandatory">
            *
          </span>
        )}
      </Label>

      {type === 'dropdown' ? (
        <Select value={value || NONE} onValueChange={(v) => onChange(!v || v === NONE ? '' : v)}>
          <SelectTrigger id={id} className={cn('w-full', inputClassName)}>
            <SelectValue>{value || 'Choose…'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE} className="text-muted-foreground">
              —
            </SelectItem>
            {dropdownOptions(field.field_options).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
          inputMode={type === 'number' ? 'decimal' : undefined}
          step={type === 'number' ? 'any' : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={type === 'date' ? undefined : `Enter ${field.field_name}…`}
          required={Boolean(field.is_required)}
          className={inputClassName}
        />
      )}
    </div>
  );
}
