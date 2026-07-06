'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Lock,
  Save,
  Upload,
} from 'lucide-react';

import { useCan } from '@/hooks/use-can';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SettingsPanelHead } from './settings-panel-head';

// Meta's `vertical` enum → human labels for the picker. Kept local
// (rather than imported from meta-api) so this client component doesn't
// pull the server-side Meta fetch module into the browser bundle.
const VERTICALS: { value: string; label: string }[] = [
  { value: 'UNDEFINED', label: 'Not set' },
  { value: 'OTHER', label: 'Other' },
  { value: 'AUTO', label: 'Automotive' },
  { value: 'BEAUTY', label: 'Beauty, spa & salon' },
  { value: 'APPAREL', label: 'Clothing & apparel' },
  { value: 'EDU', label: 'Education' },
  { value: 'ENTERTAIN', label: 'Entertainment' },
  { value: 'EVENT_PLAN', label: 'Event planning & service' },
  { value: 'FINANCE', label: 'Finance & banking' },
  { value: 'GROCERY', label: 'Food & grocery' },
  { value: 'GOVT', label: 'Public service' },
  { value: 'HOTEL', label: 'Hotel & lodging' },
  { value: 'HEALTH', label: 'Medical & health' },
  { value: 'NONPROFIT', label: 'Non-profit' },
  { value: 'PROF_SERVICES', label: 'Professional services' },
  { value: 'RETAIL', label: 'Shopping & retail' },
  { value: 'TRAVEL', label: 'Travel & transportation' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'NOT_A_BIZ', label: 'Not a business' },
];

const LIMITS = { about: 139, address: 256, description: 512, email: 128 };

type NotConfiguredReason = 'no_config' | 'token_corrupted' | 'meta_api_error';

export function BusinessProfile() {
  const canEdit = useCan('edit-settings');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [notConfigured, setNotConfigured] = useState<{
    reason: NotConfiguredReason;
    message: string;
  } | null>(null);

  const [about, setAbout] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [vertical, setVertical] = useState('UNDEFINED');
  const [website1, setWebsite1] = useState('');
  const [website2, setWebsite2] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/business-profile');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load business profile');
        setConfigured(false);
        return;
      }
      if (!data.configured) {
        setConfigured(false);
        setNotConfigured({ reason: data.reason, message: data.message });
        return;
      }
      setConfigured(true);
      const p = data.profile ?? {};
      setAbout(p.about ?? '');
      setDescription(p.description ?? '');
      setAddress(p.address ?? '');
      setEmail(p.email ?? '');
      setVertical(p.vertical || 'UNDEFINED');
      setWebsite1(p.websites?.[0] ?? '');
      setWebsite2(p.websites?.[1] ?? '');
      setPhotoUrl(p.profile_picture_url ?? null);
    } catch {
      toast.error('Failed to load business profile');
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const websites = [website1, website2]
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch('/api/whatsapp/business-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          about,
          description,
          address,
          email,
          vertical,
          websites,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save business profile');
        return;
      }
      toast.success('Business profile updated');
    } catch {
      toast.error('Failed to save business profile');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setUploadingPhoto(true);
    // Optimistic local preview while Meta processes the upload.
    const localPreview = URL.createObjectURL(file);
    const previousUrl = photoUrl;
    setPhotoUrl(localPreview);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/whatsapp/business-profile/photo', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to upload photo');
        setPhotoUrl(previousUrl);
        return;
      }
      toast.success('Profile photo updated');
      if (data.profile_picture_url) setPhotoUrl(data.profile_picture_url);
    } catch {
      toast.error('Failed to upload photo');
      setPhotoUrl(previousUrl);
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploadingPhoto(false);
    }
  }

  // Meta may return a vertical we don't have a label for (rare, added
  // after this list). Surface it as its raw code rather than dropping it.
  const verticalOptions =
    vertical && !VERTICALS.some((v) => v.value === vertical)
      ? [...VERTICALS, { value: vertical, label: vertical }]
      : VERTICALS;

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Business Profile"
          description="The public details customers see when they tap your business name in a chat."
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (configured === false) {
    const isTokenIssue = notConfigured?.reason === 'token_corrupted';
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Business Profile"
          description="The public details customers see when they tap your business name in a chat."
        />
        <Alert>
          <AlertTriangle className="size-5 shrink-0 text-amber-500" />
          <AlertTitle>
            {isTokenIssue
              ? 'WhatsApp token needs a reset'
              : 'Connect WhatsApp first'}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {notConfigured?.message ??
                'WhatsApp is not connected yet. Connect it to manage your business profile.'}
            </p>
            <Link
              href="/settings/whatsapp"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Go to WhatsApp settings
              <ExternalLink className="size-3.5" />
            </Link>
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  return (
    <section className="animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="Business Profile"
        description="The public details customers see when they tap your business name in a chat. Changes are saved to your WhatsApp Business account via the Meta API."
        action={
          canEdit ? (
            <Button onClick={handleSave} disabled={saving} className="h-10">
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save changes
            </Button>
          ) : null
        }
      />

      {!canEdit && (
        <Alert className="mb-5">
          <Lock className="size-4 shrink-0 text-muted-foreground" />
          <AlertDescription>
            You have read-only access. Only admins and owners can edit the
            business profile.
          </AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        {/* Photo hero */}
        <div className="flex flex-wrap items-center gap-5 border-b border-border bg-muted/30 px-6 py-5">
          <Avatar size="lg" className="size-20 ring-2 ring-border">
            {photoUrl ? (
              <AvatarImage src={photoUrl} alt="Business profile photo" />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
              {(about || 'B').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Profile photo
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Shown next to your business name. JPEG or PNG · up to 5 MB.
            </p>
            {canEdit && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    handlePhoto(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {photoUrl ? 'Change photo' : 'Upload photo'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <CardContent className="space-y-6 px-6 py-6">
          {/* About */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bp-about" className="text-foreground">
                About
              </Label>
              <span className="text-xs text-muted-foreground">
                {about.length}/{LIMITS.about}
              </span>
            </div>
            <Input
              id="bp-about"
              value={about}
              onChange={(e) => setAbout(e.target.value.slice(0, LIMITS.about))}
              placeholder="A short tagline shown under your name"
              disabled={!canEdit}
              maxLength={LIMITS.about}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bp-description" className="text-foreground">
                Description
              </Label>
              <span className="text-xs text-muted-foreground">
                {description.length}/{LIMITS.description}
              </span>
            </div>
            <Textarea
              id="bp-description"
              value={description}
              onChange={(e) =>
                setDescription(e.target.value.slice(0, LIMITS.description))
              }
              placeholder="Tell customers what your business does"
              className="min-h-24 resize-none"
              disabled={!canEdit}
              maxLength={LIMITS.description}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="bp-email" className="text-foreground">
                Contact email
              </Label>
              <Input
                id="bp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.slice(0, LIMITS.email))}
                placeholder="hello@yourbusiness.com"
                disabled={!canEdit}
                maxLength={LIMITS.email}
              />
            </div>

            {/* Vertical */}
            <div className="space-y-2">
              <Label htmlFor="bp-vertical" className="text-foreground">
                Industry
              </Label>
              <Select
                value={vertical}
                onValueChange={(v) => setVertical(v ?? 'UNDEFINED')}
                disabled={!canEdit}
              >
                <SelectTrigger
                  id="bp-vertical"
                  className="h-11 w-full border-border bg-transparent"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {verticalOptions.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bp-address" className="text-foreground">
                Address
              </Label>
              <span className="text-xs text-muted-foreground">
                {address.length}/{LIMITS.address}
              </span>
            </div>
            <Input
              id="bp-address"
              value={address}
              onChange={(e) =>
                setAddress(e.target.value.slice(0, LIMITS.address))
              }
              placeholder="Street, city, country"
              disabled={!canEdit}
              maxLength={LIMITS.address}
            />
          </div>

          {/* Websites */}
          <div className="space-y-2">
            <Label className="text-foreground">Websites</Label>
            <p className="text-xs text-muted-foreground">
              Up to two links. Must start with http:// or https://
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                value={website1}
                onChange={(e) => setWebsite1(e.target.value)}
                placeholder="https://yourbusiness.com"
                disabled={!canEdit}
                inputMode="url"
              />
              <Input
                value={website2}
                onChange={(e) => setWebsite2(e.target.value)}
                placeholder="https://instagram.com/yourbusiness"
                disabled={!canEdit}
                inputMode="url"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="mt-5 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="h-11">
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save changes
          </Button>
        </div>
      )}
    </section>
  );
}
