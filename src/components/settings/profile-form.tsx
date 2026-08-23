'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, Mail, CircleAlert } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import {
  deleteAccountMedia,
  uploadAccountMedia,
} from '@/lib/storage/upload-media';
import { storagePathFromPublicUrl } from '@/lib/storage/paths';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';

/** Matches the Supabase bucket name, and the R2 path prefix allow-listed
 *  in /api/storage/upload-url. */
const AVATAR_BUCKET = 'avatars';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

// Rough email shape check — the real validator is Supabase Auth, which
// rejects anything malformed when we call updateUser({ email }). We
// just want to stop obvious typos before making a network call.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfileForm() {
  const { user, profile, refreshProfile } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailChangePending, setEmailChangePending] = useState(false);

  // Seed form state once the profile loads.
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    setEmail(profile.email ?? '');
  }, [profile]);

  // Cleanup object URLs to avoid leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // There is no way to clear a photo any more — only to replace one —
  // so this is the staged preview if there is one, otherwise whatever
  // is saved.
  const currentAvatar = previewUrl ?? profile?.avatar_url ?? null;

  const initial = (fullName || profile?.full_name || profile?.email || 'U')
    .charAt(0)
    .toUpperCase();

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be re-picked
    if (!file) return;

    if (!ALLOWED_MIME.has(file.type)) {
      toast.error('Unsupported image type', {
        description: 'Use PNG, JPG, WebP, or GIF.',
      });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Image is too large', {
        description: 'Maximum 2 MB.',
      });
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingAvatar(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toast.error('Display name is required');
      return;
    }
    const trimmedEmail = email.trim();
    if (!EMAIL_RE.test(trimmedEmail)) {
      toast.error('Enter a valid email address');
      return;
    }

    setSaving(true);
    try {
      // Held separately from `nextAvatarUrl`, which is about to be
      // reassigned — this is the object that becomes garbage once a
      // replacement is saved.
      const previousAvatarUrl = profile.avatar_url ?? null;
      let nextAvatarUrl: string | null = previousAvatarUrl;

      // Upload a newly-staged image, if any.
      //
      // Routed through the shared helper so avatars land on the same
      // backend as every other upload — Cloudflare R2 where it is
      // configured, Supabase Storage otherwise. This used to call
      // Supabase Storage directly with a user-scoped path, which was
      // the one upload in the app that bypassed the shared path
      // convention and the plan storage check.
      if (pendingAvatar) {
        const { publicUrl } = await uploadAccountMedia(
          AVATAR_BUCKET,
          pendingAvatar,
        );
        nextAvatarUrl = publicUrl;
      }

      // Persist name + avatar to profiles.
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: trimmedName,
          avatar_url: nextAvatarUrl,
        })
        .eq('user_id', user.id);
      if (updateError) {
        throw new Error(`Save failed: ${updateError.message}`);
      }

      // The replacement is saved and nothing points at the old file any
      // more, so it can go.
      //
      // Strictly AFTER the update, never before: deleting first would
      // leave the row pointing at an object that no longer exists if the
      // update then failed, and a broken avatar is worse than an orphan.
      //
      // Best-effort and unawaited. A delete that fails costs a few KB in
      // a bucket; it is not worth a red toast on top of a save that
      // worked, and not worth making the user wait for either.
      //
      // `storagePathFromPublicUrl` returning null is the important
      // case, not an edge one: it is what stops this touching an avatar
      // we never uploaded, such as the one a social login brought with
      // it. The delete route also re-checks the account segment against
      // the session, so a bad parse cannot reach another tenant's file.
      if (
        pendingAvatar &&
        previousAvatarUrl &&
        previousAvatarUrl !== nextAvatarUrl
      ) {
        const stalePath = storagePathFromPublicUrl(
          AVATAR_BUCKET,
          previousAvatarUrl,
        );
        if (stalePath) {
          void deleteAccountMedia(AVATAR_BUCKET, stalePath).catch(() => {});
        }
      }

      // Email change goes through Supabase Auth, which emails a
      // confirmation to both the old and new addresses. We don't
      // touch profiles.email — Supabase will push the change there
      // after the user clicks the link (handled by the handle_new_user
      // trigger pattern in production deployments).
      let emailSent = false;
      if (trimmedEmail.toLowerCase() !== profile.email.toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: trimmedEmail,
        });
        if (emailError) {
          // Partial success: name/avatar saved but email didn't.
          toast.success('Profile saved');
          toast.error(`Email change failed: ${emailError.message}`);
          setSaving(false);
          await refreshProfile();
          return;
        }
        emailSent = true;
      }

      setEmailChangePending(emailSent);
      setPendingAvatar(null);
      setPreviewUrl(null);
      await refreshProfile();

      toast.success(
        emailSent
          ? 'Profile saved — check your email to confirm the address change'
          : 'Profile saved',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    !!profile &&
    (fullName.trim() !== (profile.full_name ?? '') ||
      email.trim().toLowerCase() !== (profile.email ?? '').toLowerCase() ||
      pendingAvatar !== null);

  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  return (
    <form onSubmit={onSubmit}>
      <Card className="overflow-hidden py-0 gap-0">
        {/* Avatar hero */}
        <div className="flex flex-wrap items-center gap-5 border-b border-border bg-muted/30 px-6 py-5">
          <Avatar size="lg" className="size-20 ring-2 ring-border">
            {currentAvatar ? (
              <AvatarImage src={currentAvatar} alt={fullName || 'Avatar'} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-foreground">
              {fullName || profile?.full_name || '—'}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {profile?.email ?? ''}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={onPickFile}
              />
              {/* The only control here now. The format-and-size line
                  that used to sit beside it is gone: it spent a row of
                  the card restating limits that almost nobody is about
                  to breach, and onPickFile still rejects the wrong type
                  or an oversized file with a toast that says which it
                  was — at the moment it is actually useful.

                  Removing a photo went with it. What that button
                  actually produced was an account with a letter where a
                  face had been; replacing one is the thing people come
                  here to do. */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
              >
                <Upload className="size-4" />
                {currentAvatar ? 'Change photo' : 'Set profile photo'}
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="space-y-6 px-6 py-6">
          {/* Editable fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-full-name" className="text-foreground">
                Display name
              </Label>
              <Input
                id="profile-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ada Lovelace"
                maxLength={120}
                disabled={saving}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email" className="text-foreground">
                Email
              </Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={saving}
                required
              />
            </div>
          </div>

          {emailChangePending && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <Mail className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Check the inbox for <strong>{profile?.email}</strong> and{' '}
                <strong>{email}</strong> — both need to confirm before the
                change takes effect.
              </span>
            </p>
          )}

          {/* Read-only account details */}
          <dl className="divide-y divide-border rounded-lg border border-border text-sm">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                  {profile?.role ?? 'user'}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="text-foreground">{joined}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="shrink-0 text-muted-foreground">User ID</dt>
              <dd className="truncate font-mono text-xs text-muted-foreground">
                {user?.id ?? '—'}
              </dd>
            </div>
          </dl>

          {!profile && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleAlert className="size-4" />
              Loading your profile…
            </p>
          )}
        </CardContent>

        {/* Footer save bar */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-6 py-4">
          <p className="text-xs text-muted-foreground">
            {dirty ? 'You have unsaved changes.' : ' '}
          </p>
          <Button type="submit" disabled={saving || !dirty || !profile}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </Card>
    </form>
  );
}
