import { ChevronDown, Calendar, X } from 'lucide-react';
import type { FormField, FormFieldType } from '@/types';

/**
 * Live mockup of the actual WhatsApp Flow screen a customer sees after
 * tapping the form's button — deliberately styled after WhatsApp's own
 * UI (its teal, its near-black text) rather than wacrm's theme, since
 * the point is "what will this look like in WhatsApp," not "what does
 * this look like in wacrm." Purely a preview: no input is editable here.
 */

const WA_TEAL = '#008069';
const WA_TEXT = '#111B21';
const WA_SUBTEXT = '#667781';
const WA_BORDER = '#D1D7DB';

function FieldPreview({ field }: { field: FormField }) {
  const label = field.label.trim() || 'Untitled field';
  const requiredMark = field.required ? <span style={{ color: WA_TEAL }}> *</span> : null;

  const boxedTypes: FormFieldType[] = ['short_text', 'email', 'phone', 'number', 'long_text'];
  if (boxedTypes.includes(field.type)) {
    return (
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium" style={{ color: WA_TEXT }}>
          {label}
          {requiredMark}
        </p>
        <div
          className="rounded-lg border px-3 text-[13px]"
          style={{ borderColor: WA_BORDER, color: WA_SUBTEXT, height: field.type === 'long_text' ? 64 : 40, paddingTop: field.type === 'long_text' ? 8 : 0, display: 'flex', alignItems: field.type === 'long_text' ? 'flex-start' : 'center' }}
        >
          {field.type === 'email'
            ? 'name@example.com'
            : field.type === 'phone'
              ? '+91 00000 00000'
              : field.type === 'number'
                ? '0'
                : 'Type here'}
        </div>
      </div>
    );
  }

  if (field.type === 'dropdown') {
    return (
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium" style={{ color: WA_TEXT }}>
          {label}
          {requiredMark}
        </p>
        <div
          className="flex h-10 items-center justify-between rounded-lg border px-3 text-[13px]"
          style={{ borderColor: WA_BORDER, color: WA_SUBTEXT }}
        >
          Select an option
          <ChevronDown className="size-4" style={{ color: WA_SUBTEXT }} />
        </div>
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium" style={{ color: WA_TEXT }}>
          {label}
          {requiredMark}
        </p>
        <div
          className="flex h-10 items-center justify-between rounded-lg border px-3 text-[13px]"
          style={{ borderColor: WA_BORDER, color: WA_SUBTEXT }}
        >
          DD/MM/YYYY
          <Calendar className="size-4" style={{ color: WA_SUBTEXT }} />
        </div>
      </div>
    );
  }

  if (field.type === 'radio' || field.type === 'checkbox') {
    const options = field.options && field.options.length > 0 ? field.options : [{ id: '_', title: 'Option' }];
    return (
      <div className="space-y-2">
        <p className="text-[13px] font-medium" style={{ color: WA_TEXT }}>
          {label}
          {requiredMark}
        </p>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={opt.id || i} className="flex items-center gap-2.5">
              <span
                className={field.type === 'radio' ? 'rounded-full' : 'rounded-[4px]'}
                style={{
                  width: 16,
                  height: 16,
                  border: `1.5px solid ${WA_BORDER}`,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span className="text-[13px]" style={{ color: WA_TEXT }}>
                {opt.title.trim() || `Option ${i + 1}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // opt_in — the label doubles as the checkbox text, no separate
  // heading above it (matches Meta's actual OptIn component).
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="mt-0.5 rounded-[4px]"
        style={{ width: 16, height: 16, border: `1.5px solid ${WA_BORDER}`, flexShrink: 0 }}
      />
      <p className="text-[13px]" style={{ color: WA_TEXT }}>
        {label}
        {requiredMark}
      </p>
    </div>
  );
}

export function FormPreview({ formName, fields }: { formName: string; fields: FormField[] }) {
  return (
    <div className="border-border mx-auto w-full max-w-72 overflow-hidden rounded-[2rem] border-8 border-neutral-900 bg-neutral-900 shadow-2xl">
      <div className="flex flex-col overflow-hidden rounded-[1.4rem]" style={{ backgroundColor: '#FFFFFF', height: 560 }}>
        {/* Flow chrome: just a close control, exactly like the real thing —
            no title bar text, no avatar. The screen's own title (below)
            is what tells the customer what this is. */}
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <X className="size-5" style={{ color: WA_SUBTEXT }} />
          <span className="text-[11px]" style={{ color: WA_SUBTEXT }}>
            Managed by the business
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
          <h2 className="text-[17px] font-semibold" style={{ color: WA_TEXT }}>
            {formName.trim() || 'Untitled form'}
          </h2>
          {fields.length === 0 ? (
            <p className="text-[13px]" style={{ color: WA_SUBTEXT }}>
              Add a field to see it here.
            </p>
          ) : (
            fields.map((field, i) => <FieldPreview key={field.id || i} field={field} />)
          )}
        </div>

        {/* Footer — WhatsApp Flows render this as a solid full-width bar,
            not a floating button, and it's always visible (not pushed
            off-screen by scroll). */}
        <div className="shrink-0 px-4 pb-4">
          <div
            className="flex h-11 items-center justify-center rounded-lg text-[14px] font-semibold text-white"
            style={{ backgroundColor: WA_TEAL }}
          >
            Submit
          </div>
        </div>
      </div>
    </div>
  );
}
