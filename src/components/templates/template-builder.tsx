'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, ShieldCheck, X, FolderOpen } from 'lucide-react';
import { MediaLibraryPicker } from '@/components/media/media-library-picker';
import type { MediaKind } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CampaignPreview } from '@/components/campaign-preview';
import { CarouselEditor } from '@/components/templates/carousel-editor';
import { useWhatsAppInfo } from '@/hooks/use-whatsapp-info';
import type {
  MessageTemplate,
  TemplateButton,
  TemplateSampleValues,
  TemplateType,
  CarouselCard,
} from '@/types';
import {
  extractVariableIndices,
  TEMPLATE_LIMITS,
} from '@/lib/whatsapp/template-validators';

/** Field label with an optional muted hint aligned on the right of the
 *  same line (instead of a helper paragraph below the input). */
function LabelRow({ label, hint }: { label: string; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Label className="text-muted-foreground">{label}</Label>
      {hint ? (
        <span className="text-right text-[11px] leading-tight text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

const CATEGORIES = ['Marketing', 'Utility', 'Authentication'] as const;
type HeaderFormat = 'none' | 'text' | 'image' | 'video' | 'document';
const HEADER_FORMATS: HeaderFormat[] = [
  'none',
  'text',
  'image',
  'video',
  'document',
];

const COMMON_LANGUAGE_CODES = [
  'en_US',
  'en_GB',
  'en',
  'es',
  'es_ES',
  'es_MX',
  'fr',
  'fr_FR',
  'de',
  'it',
  'pt_BR',
  'pt_PT',
  'nl',
  'pl',
  'ru',
  'tr',
  'lt',
];

interface TemplateFormData {
  name: string;
  category: MessageTemplate['category'];
  language: string;
  /** 'standard' or 'carousel' (Marketing only). */
  template_type: TemplateType;
  header_format: HeaderFormat;
  header_content: string;
  header_media_url: string;
  header_sample: string;
  body_text: string;
  body_samples: string[];
  footer_text: string;
  buttons: TemplateButton[];
  // Carousel-specific
  carousel_format: 'image' | 'video';
  carousel_cards: CarouselCard[];
  // Authentication-specific
  auth_button_text: string;
  auth_security_recommendation: boolean;
  auth_expiry_minutes: string;
}

const emptyForm: TemplateFormData = {
  name: '',
  category: 'Marketing',
  language: 'en_US',
  template_type: 'standard',
  header_format: 'none',
  header_content: '',
  header_media_url: '',
  header_sample: '',
  body_text: '',
  body_samples: [],
  footer_text: '',
  buttons: [],
  carousel_format: 'image',
  carousel_cards: [],
  auth_button_text: 'Copy code',
  auth_security_recommendation: true,
  auth_expiry_minutes: '',
};

function emptyButton(type: TemplateButton['type']): TemplateButton {
  switch (type) {
    case 'QUICK_REPLY':
      return { type: 'QUICK_REPLY', text: '' };
    case 'URL':
      return { type: 'URL', text: '', url: '' };
    case 'PHONE_NUMBER':
      return { type: 'PHONE_NUMBER', text: '', phone_number: '' };
    case 'COPY_CODE':
      return { type: 'COPY_CODE', text: '', example: '' };
  }
}

function formFromTemplate(t: MessageTemplate): TemplateFormData {
  const authConfig = t.sample_values?.auth;
  return {
    name: t.name,
    category: t.category,
    language: t.language || 'en_US',
    template_type: t.template_type ?? 'standard',
    header_format: (t.header_type ?? 'none') as HeaderFormat,
    header_content: t.header_content ?? '',
    header_media_url: t.header_media_url ?? '',
    header_sample: t.sample_values?.header?.[0] ?? '',
    body_text: t.body_text,
    body_samples: t.sample_values?.body ?? [],
    footer_text: t.footer_text ?? '',
    buttons: t.category === 'Authentication' ? [] : (t.buttons ?? []),
    carousel_format: t.carousel_card_format ?? 'image',
    carousel_cards: t.carousel_cards ?? [],
    auth_button_text:
      t.category === 'Authentication'
        ? (t.buttons?.[0]?.text ?? 'Copy code')
        : 'Copy code',
    auth_security_recommendation: authConfig?.add_security_recommendation ?? true,
    auth_expiry_minutes: authConfig?.code_expiration_minutes
      ? String(authConfig.code_expiration_minutes)
      : '',
  };
}

export function TemplateBuilder({
  initial = null,
}: {
  /** When set, the builder is in edit mode and pre-fills from this row. */
  initial?: MessageTemplate | null;
}) {
  const router = useRouter();

  const isEdit = initial !== null;
  const isMetaEdit = !!initial?.meta_template_id;

  const [form, setForm] = useState<TemplateFormData>(() =>
    initial ? formFromTemplate(initial) : emptyForm,
  );
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);

  const isAuth = form.category === 'Authentication';
  const waInfo = useWhatsAppInfo();
  // Carousel is a Marketing-only template shape.
  const isCarousel =
    form.template_type === 'carousel' && form.category === 'Marketing';

  const bodyVarCount = useMemo(
    () => (isAuth ? 0 : extractVariableIndices(form.body_text).length),
    [form.body_text, isAuth],
  );
  const headerVarCount = useMemo(
    () =>
      form.header_format === 'text'
        ? extractVariableIndices(form.header_content).length
        : 0,
    [form.header_format, form.header_content],
  );

  // Keep body_samples sized to exactly bodyVarCount entries.
  useEffect(() => {
    setForm((prev) => {
      if (prev.body_samples.length === bodyVarCount) return prev;
      const next = prev.body_samples.slice(0, bodyVarCount);
      while (next.length < bodyVarCount) next.push('');
      return { ...prev, body_samples: next };
    });
  }, [bodyVarCount]);

  const headerNeedsMedia =
    form.header_format !== 'none' && form.header_format !== 'text';

  // Synthetic template for the WhatsApp preview — mirrors the live form.
  const previewTemplate: MessageTemplate = useMemo(() => {
    if (isAuth) {
      const secRec = form.auth_security_recommendation;
      const expiry = parseInt(form.auth_expiry_minutes) || null;
      const bodyLines = ['{{1}} is your verification code.'];
      if (secRec) bodyLines.push('\n\nFor your security, do not share this code.');
      return {
        id: 'preview',
        user_id: '',
        name: form.name || 'preview',
        category: 'Authentication',
        language: form.language,
        body_text: bodyLines.join(''),
        footer_text: expiry
          ? `This code expires in ${expiry} minute${expiry === 1 ? '' : 's'}.`
          : undefined,
        buttons: [
          {
            type: 'COPY_CODE',
            text: form.auth_button_text.trim() || 'Copy code',
            example: '123456',
          },
        ],
        created_at: '',
      };
    }
    return {
      id: 'preview',
      user_id: '',
      name: form.name,
      category: form.category,
      language: form.language,
      template_type: isCarousel ? 'carousel' : 'standard',
      header_type:
        isCarousel || form.header_format === 'none'
          ? undefined
          : form.header_format,
      header_content:
        form.header_format === 'text' ? form.header_content : undefined,
      header_media_url:
        !isCarousel && headerNeedsMedia ? form.header_media_url : undefined,
      body_text: form.body_text,
      footer_text: isCarousel ? undefined : form.footer_text || undefined,
      buttons: isCarousel ? undefined : form.buttons.filter((b) => b.text.trim()),
      carousel_card_format: isCarousel ? form.carousel_format : undefined,
      carousel_cards: isCarousel ? form.carousel_cards : undefined,
      created_at: '',
    };
  }, [form, isAuth, isCarousel, headerNeedsMedia]);

  function buildSubmitPayload() {
    if (isAuth) {
      const expiry = parseInt(form.auth_expiry_minutes) || undefined;
      const authConfig: TemplateSampleValues['auth'] = {
        add_security_recommendation: form.auth_security_recommendation,
        ...(expiry ? { code_expiration_minutes: expiry } : {}),
      };
      return {
        name: form.name.trim(),
        category: form.category,
        language: form.language.trim() || 'en_US',
        // Placeholder body satisfies the NOT NULL column; Meta ignores it
        // for Authentication and auto-generates the body from the App name.
        body_text: '{{1}} is your verification code.',
        buttons: [
          {
            type: 'COPY_CODE' as const,
            text: form.auth_button_text.trim() || 'Copy code',
            example: '123456',
          },
        ],
        sample_values: { auth: authConfig },
      };
    }

    const sample_values: TemplateSampleValues = {};
    if (form.body_samples.some((v) => v.trim())) {
      sample_values.body = form.body_samples.map((v) => v.trim());
    }
    if (form.header_format === 'text' && form.header_sample.trim()) {
      sample_values.header = [form.header_sample.trim()];
    }

    if (isCarousel) {
      return {
        name: form.name.trim(),
        category: form.category,
        language: form.language.trim() || 'en_US',
        template_type: 'carousel' as const,
        body_text: form.body_text.trim(),
        carousel_card_format: form.carousel_format,
        carousel_cards: form.carousel_cards.map((c) => ({
          media_url: c.media_url.trim(),
          media_handle: c.media_handle,
          body_text: c.body_text.trim(),
          buttons: c.buttons.map((b) =>
            b.type === 'URL'
              ? { type: 'URL' as const, text: b.text.trim(), url: b.url.trim() }
              : { type: 'QUICK_REPLY' as const, text: b.text.trim() },
          ),
        })),
        sample_values:
          Object.keys(sample_values).length > 0 ? sample_values : undefined,
      };
    }

    return {
      name: form.name.trim(),
      category: form.category,
      language: form.language.trim() || 'en_US',
      header_type: form.header_format === 'none' ? undefined : form.header_format,
      header_content:
        form.header_format === 'text' ? form.header_content.trim() : undefined,
      header_media_url:
        form.header_format !== 'none' && form.header_format !== 'text'
          ? form.header_media_url.trim() || undefined
          : undefined,
      body_text: form.body_text.trim(),
      footer_text: form.footer_text.trim() || undefined,
      buttons: form.buttons.length > 0 ? form.buttons : undefined,
      sample_values:
        Object.keys(sample_values).length > 0 ? sample_values : undefined,
    };
  }

  async function handleSubmit() {
    try {
      setSubmitting(true);
      const url = isMetaEdit
        ? `/api/whatsapp/templates/${initial!.id}`
        : '/api/whatsapp/templates/submit';
      const res = await fetch(url, {
        method: isMetaEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSubmitPayload()),
      });
      const data = await res.json();
      if (!res.ok) {
        // saved_as_draft=true means the template was persisted locally but
        // Meta rejected it (e.g. Authentication access not yet granted).
        // Show a warning toast and navigate away — the user can re-submit
        // later once Meta access is in place.
        if (data?.saved_as_draft) {
          toast.warning(data.error, { duration: 8000 });
          router.push('/templates');
          return;
        }
        throw new Error(
          data?.error ||
            `${isMetaEdit ? 'Edit' : 'Submit'} failed (HTTP ${res.status})`,
        );
      }
      toast.success(
        data.dry_run
          ? 'Template saved (dry-run — no Meta call)'
          : isMetaEdit
            ? 'Edit submitted — Meta typically reviews within 24 hours.'
            : 'Submitted to Meta — typical review time is 24 hours. Status updates automatically.',
      );
      router.push('/templates');
    } catch (err) {
      console.error('Submit error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    if (!form.name.trim()) {
      toast.error('Give the template a name before saving a draft.');
      return;
    }
    try {
      setSavingDraft(true);
      const res = await fetch('/api/whatsapp/templates/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSubmitPayload()),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Save failed (HTTP ${res.status})`);
      }
      toast.success('Draft saved');
      router.push('/templates');
    } catch (err) {
      console.error('Save draft error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  }

  type ButtonPatch = {
    text?: string;
    url?: string;
    phone_number?: string;
    example?: string;
  };
  function updateButton(index: number, patch: ButtonPatch) {
    setForm((prev) => {
      const current = prev.buttons[index];
      if (!current) return prev;
      const next = [...prev.buttons];
      switch (current.type) {
        case 'QUICK_REPLY':
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
          };
          break;
        case 'URL':
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
            ...(patch.url !== undefined && { url: patch.url }),
            ...(patch.example !== undefined && { example: patch.example }),
          };
          break;
        case 'PHONE_NUMBER':
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
            ...(patch.phone_number !== undefined && {
              phone_number: patch.phone_number,
            }),
          };
          break;
        case 'COPY_CODE':
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
            ...(patch.example !== undefined && { example: patch.example }),
          };
          break;
      }
      return { ...prev, buttons: next };
    });
  }

  function changeButtonType(index: number, type: TemplateButton['type']) {
    setForm((prev) => {
      const next = [...prev.buttons];
      next[index] = emptyButton(type);
      return { ...prev, buttons: next };
    });
  }

  function removeButton(index: number) {
    setForm((prev) => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index),
    }));
  }

  function addButton() {
    if (form.buttons.length >= TEMPLATE_LIMITS.maxButtonsTotal) return;
    setForm((prev) => ({
      ...prev,
      buttons: [...prev.buttons, emptyButton('QUICK_REPLY')],
    }));
  }

  const busy = submitting || savingDraft;

  return (
    <div className="w-full space-y-6">
      <div className="border-border flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {isEdit ? 'Edit Template' : 'New Template'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Build a template and preview exactly what your recipient sees.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/templates')}
          className="border-border text-muted-foreground"
        >
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[6fr_4fr] lg:gap-14">
        <div className="min-w-0 space-y-4">
          {/* ── Name + Type ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <div className="space-y-2">
              <LabelRow
                label="Template Name"
                hint={
                  isEdit
                    ? 'Fixed once created'
                    : 'Lowercase letters, digits, underscores only'
                }
              />
              <Input
                placeholder="e.g. order_confirmation"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={isEdit}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <LabelRow
                label="Type"
                hint={form.category === 'Marketing' ? undefined : 'Marketing only'}
              />
              <Select
                value={form.template_type}
                onValueChange={(val) => {
                  if (!val) return;
                  const t = val as TemplateType;
                  setForm((f) => ({
                    ...f,
                    template_type: t,
                    // Seed two empty cards when first entering carousel.
                    carousel_cards:
                      t === 'carousel' && f.carousel_cards.length < 2
                        ? [
                            { media_url: '', body_text: '', buttons: [] },
                            { media_url: '', body_text: '', buttons: [] },
                          ]
                        : f.carousel_cards,
                  }));
                }}
                disabled={isEdit || isAuth || form.category !== 'Marketing'}
              >
                <SelectTrigger className="data-[size=default]:h-11 w-full bg-muted border-border text-foreground disabled:opacity-60 disabled:cursor-not-allowed">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem
                    value="standard"
                    className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                  >
                    Standard
                  </SelectItem>
                  <SelectItem
                    value="carousel"
                    className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                  >
                    Carousel
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Category + Language ───────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Category</Label>
              <Select
                value={form.category}
                onValueChange={(val) =>
                  setForm({
                    ...form,
                    category: val as MessageTemplate['category'],
                    // Carousel is Marketing-only — leaving Marketing
                    // silently falls back to a standard template.
                    template_type:
                      val === 'Marketing' ? form.template_type : 'standard',
                  })
                }
                disabled={isEdit}
              >
                <SelectTrigger className="data-[size=default]:h-11 w-full bg-muted border-border text-foreground disabled:opacity-60 disabled:cursor-not-allowed">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {CATEGORIES.map((cat) => (
                    <SelectItem
                      key={cat}
                      value={cat}
                      className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                    >
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <LabelRow
                label="Language"
                hint={isEdit ? 'Fixed once created' : 'Exact Meta code'}
              />
              <Input
                list="template-language-codes"
                placeholder="en_US"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                disabled={isEdit}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <datalist id="template-language-codes">
                {COMMON_LANGUAGE_CODES.map((code) => (
                  <option key={code} value={code} />
                ))}
              </datalist>
            </div>
          </div>

          {/* ── Authentication-specific fields ──────────────────────── */}
          {isAuth ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-950/20 px-4 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-300">
                    Authentication (OTP) template
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Meta auto-generates the body text from your App name + the
                    OTP code. Configure the Copy Code button label, security
                    recommendation, and optional code expiry below.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Button Label</Label>
                <Input
                  placeholder="Copy code"
                  value={form.auth_button_text}
                  maxLength={TEMPLATE_LIMITS.buttonTextMaxLength}
                  onChange={(e) =>
                    setForm({ ...form, auth_button_text: e.target.value })
                  }
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
                <p className="text-[11px] text-muted-foreground">
                  Text shown on the Copy Code button (max{' '}
                  {TEMPLATE_LIMITS.buttonTextMaxLength} chars).
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3.5 py-3">
                <Switch
                  checked={form.auth_security_recommendation}
                  onCheckedChange={(v) =>
                    setForm({ ...form, auth_security_recommendation: v })
                  }
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Add security recommendation
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Appends{' '}
                    <span className="italic text-foreground/70">
                      &ldquo;For your security, do not share this code.&rdquo;
                    </span>{' '}
                    to the message.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Code expiry{' '}
                  <span className="text-muted-foreground/60">(optional)</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    placeholder="e.g. 5"
                    value={form.auth_expiry_minutes}
                    onChange={(e) =>
                      setForm({ ...form, auth_expiry_minutes: e.target.value })
                    }
                    className="w-24 bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Adds &ldquo;This code expires in N minutes.&rdquo; as the footer
                  (1–90 min). Leave empty to omit.
                </p>
              </div>
            </div>
          ) : (
            /* ── Marketing / Utility fields ──────────────────────────── */
            <>
              {!isCarousel && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Header</Label>
                <Select
                  value={form.header_format}
                  onValueChange={(val) =>
                    setForm({
                      ...form,
                      header_format: (val || 'none') as HeaderFormat,
                    })
                  }
                >
                  <SelectTrigger className="data-[size=default]:h-11 w-full bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {HEADER_FORMATS.map((type) => (
                      <SelectItem
                        key={type}
                        value={type}
                        className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                      >
                        {type === 'none'
                          ? 'None'
                          : type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {form.header_format === 'text' && (
                  <div className="space-y-2 mt-2">
                    <Input
                      id="template-header-text"
                      aria-label="Header text"
                      placeholder="Header text (max 60 chars, optional {{1}})"
                      value={form.header_content}
                      onChange={(e) =>
                        setForm({ ...form, header_content: e.target.value })
                      }
                      maxLength={TEMPLATE_LIMITS.headerTextMaxLength}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                    {headerVarCount > 0 && (
                      <Input
                        id="template-header-sample"
                        aria-label="Sample value for header variable"
                        placeholder="Sample value for {{1}} (required for Meta review)"
                        value={form.header_sample}
                        onChange={(e) =>
                          setForm({ ...form, header_sample: e.target.value })
                        }
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                      />
                    )}
                  </div>
                )}

                {headerNeedsMedia && (
                  <div className="space-y-2 mt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLibraryPickerOpen(true)}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        {form.header_media_url
                          ? 'Change media'
                          : 'Pick from library'}
                      </Button>
                      {form.header_media_url && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm({ ...form, header_media_url: '' })
                          }
                          className="text-[11px] font-medium text-muted-foreground hover:text-destructive"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <MediaLibraryPicker
                      open={libraryPickerOpen}
                      onOpenChange={setLibraryPickerOpen}
                      kind={form.header_format as MediaKind}
                      onSelect={(item) =>
                        setForm((f) => ({
                          ...f,
                          header_media_url: item.public_url,
                        }))
                      }
                    />
                    {form.header_media_url &&
                      (form.header_format === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={form.header_media_url}
                          alt="Header sample"
                          className="max-h-28 rounded-md border border-border object-contain"
                        />
                      ) : form.header_format === 'video' ? (
                        <video
                          src={form.header_media_url}
                          controls
                          className="max-h-28 rounded-md border border-border"
                        />
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                          <FolderOpen className="h-4 w-4" />
                          Document selected
                        </div>
                      ))}
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Choose a {form.header_format} from your Media library — it&apos;s
                      uploaded to Meta for review automatically. Manage files on the{' '}
                      <span className="font-medium text-foreground">Media</span> page.
                    </p>
                  </div>
                )}
              </div>
              )}

              <div className="space-y-2">
                <LabelRow
                  label={
                    isCarousel ? 'Message text (above cards)' : 'Body Text'
                  }
                  hint={
                    <>
                      {`{{1}}`}, {`{{2}}`} = variables (contiguous)
                    </>
                  }
                />
                <Textarea
                  placeholder="Hello {{1}}, your order {{2}} is confirmed."
                  value={form.body_text}
                  onChange={(e) =>
                    setForm({ ...form, body_text: e.target.value })
                  }
                  rows={4}
                  maxLength={TEMPLATE_LIMITS.bodyMaxLength}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground resize-none"
                />

                {bodyVarCount > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Sample values (Meta uses these to review your template)
                    </Label>
                    {form.body_samples.map((val, i) => {
                      const inputId = `template-body-sample-${i}`;
                      return (
                        <Input
                          key={i}
                          id={inputId}
                          aria-label={`Sample value for body variable {{${i + 1}}}`}
                          placeholder={`Sample for {{${i + 1}}}`}
                          value={val}
                          onChange={(e) => {
                            const next = [...form.body_samples];
                            next[i] = e.target.value;
                            setForm({ ...form, body_samples: next });
                          }}
                          className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {isCarousel && (
                <CarouselEditor
                  format={form.carousel_format}
                  onFormatChange={(f) =>
                    setForm((prev) => ({ ...prev, carousel_format: f }))
                  }
                  cards={form.carousel_cards}
                  onChange={(cards) =>
                    setForm((prev) => ({ ...prev, carousel_cards: cards }))
                  }
                />
              )}

              {!isCarousel && (
              <>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Footer (optional)</Label>
                <Input
                  placeholder="Optional footer text (max 60 chars)"
                  value={form.footer_text}
                  onChange={(e) =>
                    setForm({ ...form, footer_text: e.target.value })
                  }
                  maxLength={TEMPLATE_LIMITS.footerMaxLength}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground">
                    Buttons (optional)
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addButton}
                    disabled={
                      form.buttons.length >= TEMPLATE_LIMITS.maxButtonsTotal
                    }
                    className="border-border bg-transparent text-muted-foreground hover:bg-muted h-7 text-xs"
                  >
                    <Plus className="size-3" />
                    Add Button
                  </Button>
                </div>
                {form.buttons.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Up to {TEMPLATE_LIMITS.maxButtonsTotal} buttons. QUICK_REPLY
                    buttons must come before URL / phone / copy-code buttons.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.buttons.map((btn, i) => (
                      <div
                        key={i}
                        className="space-y-2 rounded border border-border bg-muted/50 p-2"
                      >
                        <div className="flex items-center gap-2">
                          <Select
                            value={btn.type}
                            onValueChange={(val) => {
                              if (!val) return;
                              changeButtonType(
                                i,
                                val as TemplateButton['type'],
                              );
                            }}
                          >
                            <SelectTrigger className="w-40 bg-muted border-border text-foreground h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              <SelectItem
                                value="QUICK_REPLY"
                                className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                              >
                                Quick Reply
                              </SelectItem>
                              <SelectItem
                                value="URL"
                                className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                              >
                                URL
                              </SelectItem>
                              <SelectItem
                                value="PHONE_NUMBER"
                                className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                              >
                                Phone
                              </SelectItem>
                              <SelectItem
                                value="COPY_CODE"
                                className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                              >
                                Copy Code
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Button label"
                            value={btn.text}
                            maxLength={TEMPLATE_LIMITS.buttonTextMaxLength}
                            onChange={(e) =>
                              updateButton(i, { text: e.target.value })
                            }
                            className="flex-1 bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 text-xs"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeButton(i)}
                            className="text-muted-foreground hover:text-red-400 hover:bg-red-950/30 size-7"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                        {btn.type === 'URL' && (
                          <div className="space-y-1 pl-1">
                            <Input
                              placeholder="https://example.com/path or with {{1}} suffix"
                              value={btn.url}
                              onChange={(e) =>
                                updateButton(i, { url: e.target.value })
                              }
                              className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 text-xs"
                            />
                            {extractVariableIndices(btn.url).length > 0 && (
                              <Input
                                placeholder="Example value for {{1}} (required when URL has a variable)"
                                value={btn.example ?? ''}
                                onChange={(e) =>
                                  updateButton(i, { example: e.target.value })
                                }
                                className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 text-xs"
                              />
                            )}
                          </div>
                        )}
                        {btn.type === 'PHONE_NUMBER' && (
                          <Input
                            placeholder="+15551234567"
                            value={btn.phone_number}
                            onChange={(e) =>
                              updateButton(i, { phone_number: e.target.value })
                            }
                            className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 text-xs"
                          />
                        )}
                        {btn.type === 'COPY_CODE' && (
                          <Input
                            placeholder="Example code (e.g. SUMMER20)"
                            value={btn.example}
                            onChange={(e) =>
                              updateButton(i, { example: e.target.value })
                            }
                            className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 text-xs"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </>
              )}
            </>
          )}

          {/* Actions */}
          <div className="border-border flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => router.push('/templates')}
              disabled={busy}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            {!isMetaEdit && (
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={busy || !form.name.trim()}
                className="border-border"
              >
                {savingDraft ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save as Draft'
                )}
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={busy}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {isMetaEdit ? 'Saving…' : 'Submitting…'}
                </>
              ) : isMetaEdit ? (
                'Save & Resubmit'
              ) : (
                'Submit for Approval'
              )}
            </Button>
          </div>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <CampaignPreview
            template={previewTemplate}
            variables={{}}
            businessName={waInfo?.verified_name}
          />
        </aside>
      </div>
    </div>
  );
}
