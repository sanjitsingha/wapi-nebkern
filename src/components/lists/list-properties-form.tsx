'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
];

interface ListPropertiesFormProps {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  color: string;
  onColorChange: (value: string) => void;
  disabled?: boolean;
  /** Placeholder for the name field — defaults to "List name". */
  namePlaceholder?: string;
}

/**
 * Name / description / colour fields shared by the create-list and
 * edit-list dialogs.
 */
export function ListPropertiesForm({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  color,
  onColorChange,
  disabled,
  namePlaceholder = 'List name',
}: ListPropertiesFormProps) {
  return (
    <div className="space-y-3">
      <Input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={namePlaceholder}
        className="h-11"
        disabled={disabled}
        autoFocus
        maxLength={80}
      />
      <Textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Description (optional)"
        className="min-h-16 resize-none"
        disabled={disabled}
        maxLength={280}
      />
      <div className="flex items-center gap-1.5">
        {PRESET_COLORS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onColorChange(preset.value)}
            disabled={disabled}
            aria-label={`Use ${preset.name}`}
            aria-pressed={color === preset.value}
            className={cn(
              'size-6 rounded-md transition-transform hover:scale-110 disabled:pointer-events-none disabled:opacity-50',
              color === preset.value &&
                'outline outline-2 outline-offset-2 outline-primary'
            )}
            style={{ backgroundColor: preset.value }}
            title={preset.name}
          />
        ))}
      </div>
    </div>
  );
}

export { PRESET_COLORS as LIST_COLOR_PRESETS };
