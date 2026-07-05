import { createClient } from '@/lib/supabase/client';
import {
  uploadAccountMedia,
  deleteAccountMedia,
} from '@/lib/storage/upload-media';
import type { MediaKind, MediaLibraryItem } from '@/types';

/**
 * Media library — upload / list / delete reusable template media
 * (image / video / document) that lives in the public `template-media`
 * bucket and is tracked in the `media_library` table (migration 036).
 *
 * Everything here validates against Meta's WhatsApp template header
 * caps BEFORE upload so a file the bucket might accept but Meta would
 * reject never lands as an orphan and breaks a send with a confusing
 * 400.
 */

export const TEMPLATE_MEDIA_BUCKET = 'template-media';

const MB = 1024 * 1024;

interface KindSpec {
  label: string;
  /** Meta's per-kind size ceiling for template headers. */
  maxBytes: number;
  /** Allowed MIME types (must also be in the bucket's allow-list). */
  mimes: readonly string[];
  /** Human-facing accepted extensions, for the picker copy. */
  exts: readonly string[];
  /** <input accept> string. */
  accept: string;
}

// Constraints mirror the WhatsApp Cloud API template media rules:
//   IMAGE    JPG/PNG        ≤ 5 MB
//   VIDEO    MP4/3GPP       ≤ 16 MB
//   DOCUMENT PDF/Office/TXT ≤ 16 MB (Meta allows 100 MB; the bucket caps
//                                    at 16 MB, so we mirror that)
export const MEDIA_KIND_SPECS: Record<MediaKind, KindSpec> = {
  image: {
    label: 'Image',
    maxBytes: 5 * MB,
    mimes: ['image/jpeg', 'image/png'],
    exts: ['jpg', 'jpeg', 'png'],
    accept: 'image/jpeg,image/png',
  },
  video: {
    label: 'Video',
    maxBytes: 16 * MB,
    mimes: ['video/mp4', 'video/3gpp'],
    exts: ['mp4', '3gp'],
    accept: 'video/mp4,video/3gpp',
  },
  document: {
    label: 'Document',
    maxBytes: 16 * MB,
    mimes: [
      'application/pdf',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ],
    exts: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
    accept:
      'application/pdf,application/msword,application/vnd.ms-excel,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain',
  },
};

/** Combined `accept` string covering every allowed kind. */
export const ALL_MEDIA_ACCEPT = Object.values(MEDIA_KIND_SPECS)
  .map((s) => s.accept)
  .join(',');

/** Which kind (if any) a file's MIME type maps to. */
export function detectKind(mime: string): MediaKind | null {
  for (const kind of Object.keys(MEDIA_KIND_SPECS) as MediaKind[]) {
    if (MEDIA_KIND_SPECS[kind].mimes.includes(mime)) return kind;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

export type ValidationResult =
  | { ok: true; kind: MediaKind }
  | { ok: false; error: string };

/** Validate a file against Meta's template media rules. */
export function validateMediaFile(file: File): ValidationResult {
  const kind = detectKind(file.type);
  if (!kind) {
    return {
      ok: false,
      error: `Unsupported file type. Use an image (JPG/PNG), video (MP4), or document (PDF, Office, TXT).`,
    };
  }
  const spec = MEDIA_KIND_SPECS[kind];
  if (file.size > spec.maxBytes) {
    return {
      ok: false,
      error: `${spec.label} is too large — max ${formatBytes(spec.maxBytes)} (this file is ${formatBytes(file.size)}).`,
    };
  }
  return { ok: true, kind };
}

/**
 * Best-effort pixel dimensions for an image or video, read client-side.
 * Resolves to null on any error (unsupported codec, decode failure) —
 * dimensions are a nicety, never a blocker.
 */
async function readDimensions(
  file: File,
  kind: MediaKind,
): Promise<{ width: number | null; height: number | null }> {
  if (kind === 'document') return { width: null, height: null };
  const url = URL.createObjectURL(file);
  try {
    if (kind === 'image') {
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: null, height: null });
        img.src = url;
      });
    }
    return await new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () =>
        resolve({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => resolve({ width: null, height: null });
      video.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Validate → upload to the template-media bucket → record the metadata
 * row. Returns the inserted library item. Throws with a user-facing
 * message on validation / upload / DB failure (callers toast it).
 */
export async function uploadToLibrary(file: File): Promise<MediaLibraryItem> {
  const validation = validateMediaFile(file);
  if (!validation.ok) throw new Error(validation.error);
  const kind = validation.kind;

  const supabase = createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('Not signed in.');

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileErr || !profile?.account_id) {
    throw new Error('Could not resolve your account.');
  }

  const { width, height } = await readDimensions(file, kind);
  const { publicUrl, path } = await uploadAccountMedia(
    TEMPLATE_MEDIA_BUCKET,
    file,
  );

  const row = {
    account_id: profile.account_id as string,
    user_id: user.id,
    name: file.name,
    kind,
    mime_type: file.type,
    size_bytes: file.size,
    width,
    height,
    bucket: TEMPLATE_MEDIA_BUCKET,
    path,
    public_url: publicUrl,
  };

  const { data: inserted, error: insErr } = await supabase
    .from('media_library')
    .insert(row)
    .select('*')
    .single();
  if (insErr || !inserted) {
    // Roll back the orphaned object so a failed insert doesn't leak
    // storage.
    void deleteAccountMedia(TEMPLATE_MEDIA_BUCKET, path).catch(() => {});
    throw new Error(insErr?.message ?? 'Failed to save media.');
  }
  return inserted as MediaLibraryItem;
}

/** List the account's library items, newest first. */
export async function listLibrary(): Promise<MediaLibraryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('media_library')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaLibraryItem[];
}

/** Delete a library item — removes the storage object then the row. */
export async function deleteFromLibrary(item: MediaLibraryItem): Promise<void> {
  const supabase = createClient();
  // Storage first; if the row delete fails we'd rather have a dangling
  // row (harmless, re-deletable) than a dangling public object.
  await deleteAccountMedia(item.bucket, item.path).catch(() => {});
  const { error } = await supabase
    .from('media_library')
    .delete()
    .eq('id', item.id);
  if (error) throw new Error(error.message);
}
