import { createClient } from "@/lib/supabase/client";
import { checkStorageCapacity } from "@/lib/billing/entitlements-client";
import { buildMediaPath } from "./paths";

/**
 * Shared media-upload helper. Every upload in the app goes through
 * here — the inbox composer, the Flows builder, the media library and
 * profile avatars — so the storage backend is chosen in exactly one
 * place.
 *
 * TWO BACKENDS
 *
 * Cloudflare R2 when it is configured, Supabase Storage when it is not.
 * R2 is preferred because it charges nothing for egress: on Supabase's
 * free tier every image view came out of a 5 GB monthly budget shared
 * with the rest of the app.
 *
 * The fallback is not a temporary migration state — this is a
 * self-hostable project, and a deployment without a Cloudflare account
 * must keep working exactly as it always did. `uploadViaR2` returning
 * null is the normal, supported path when R2 env vars are unset.
 *
 * Both backends use the same account-scoped layout:
 *
 *   <bucket>/account-<account_id>/<timestamp>-<basename>.<ext>
 *
 * On Supabase that leading segment is what the bucket's RLS write
 * policies match on (migrations 020/023), so a mismatched segment is
 * silently rejected. On R2 there is no RLS, so the server builds the
 * segment from the session and never trusts the client — which is why
 * the R2 path asks an API route for permission rather than constructing
 * a path locally.
 */

/** 16 MB — matches the `file_size_limit` on both buckets (migrations 016/020/023). */
export const MEDIA_MAX_BYTES = 16 * 1024 * 1024;

/**
 * Per-kind upload ceilings that mirror Meta's WhatsApp Cloud API caps so
 * a file that the bucket would accept (≤16 MB) but Meta would reject is
 * caught client-side BEFORE upload — otherwise it lands in storage as an
 * orphan and the send fails with a confusing 400. Images are Meta's
 * tightest cap at 5 MB; documents are held at the 16 MB bucket limit
 * (Meta allows 100 MB, but the bucket — and shared-hosting upload UX —
 * caps lower).
 */
export const MEDIA_MAX_BYTES_BY_KIND = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 16 * 1024 * 1024,
} as const;

// Re-exported so the existing unit test and every current import keep
// working; the implementation moved to ./paths so the server can share
// it without pulling in the browser Supabase client.
export { buildMediaPath };

export interface UploadAccountMediaResult {
  /** Public URL Meta can fetch at send time. */
  publicUrl: string;
  /** Storage object path (account-scoped). */
  path: string;
  /** Which backend holds it — decides how it gets deleted later, and
   *  lets objects uploaded before R2 was switched on keep working. */
  provider: "r2" | "supabase";
}

/**
 * Try the R2 path: ask the server for a one-time upload link, then PUT
 * the bytes straight to Cloudflare.
 *
 * Returns null when R2 isn't configured, so the caller falls back to
 * Supabase. Throws only on a real failure — a refusal we should surface
 * (file too large, not signed in) or a failed transfer.
 */
async function uploadViaR2(
  bucket: string,
  file: File,
): Promise<UploadAccountMediaResult | null> {
  const res = await fetch("/api/storage/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(body?.error ?? "Could not start the upload.");
  }
  // R2 not set up on this deployment — the caller uses Supabase.
  if (!body?.configured) return null;

  // Straight to Cloudflare, not through our server: a 16 MB file would
  // otherwise cross the app twice and hit the request-body ceiling most
  // serverless hosts impose. The Content-Type must match what the link
  // was signed for or R2 rejects it.
  const put = await fetch(body.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) {
    throw new Error("Upload failed — please try again.");
  }

  return {
    publicUrl: body.publicUrl as string,
    path: body.path as string,
    provider: "r2",
  };
}

/**
 * Upload a file to an account-scoped Storage bucket and return its public
 * URL. Throws with a user-facing message on auth / account-resolution /
 * upload failure — callers surface it via a toast.
 *
 * Size validation is the caller's responsibility (limits can differ per
 * feature); `MEDIA_MAX_BYTES` is exported for the common case.
 */
export async function uploadAccountMedia(
  bucket: string,
  file: File,
): Promise<UploadAccountMediaResult> {
  // Plan storage limit (migration 062). Checked before either backend —
  // soft-fail on a transient error so it never blocks an upload, but a
  // definitive over-limit answer does.
  const storageError = await checkStorageCapacity(file.size);
  if (storageError) throw new Error(storageError);

  // Preferred backend. Returns null only when this deployment has no R2
  // configured, in which case we fall through to Supabase below.
  const viaR2 = await uploadViaR2(bucket, file);
  if (viaR2) return viaR2;

  const supabase = createClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new Error("Not signed in.");
  }

  // Resolve account_id so the path is account-scoped (matches the
  // bucket's RLS write policy from migration 020/023). User-scoped
  // paths would be rejected.
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileErr || !profile?.account_id) {
    throw new Error("Could not resolve your account.");
  }

  const path = buildMediaPath(profile.account_id as string, file.name);
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (upErr) throw new Error(upErr.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return { publicUrl, path, provider: "supabase" };
}

/**
 * Delete a previously-uploaded object. Used to GC media that was staged
 * (uploaded) but never sent — a cancelled draft or a failed Meta send —
 * so abandoned attachments don't accumulate in the public bucket. The
 * DELETE is gated by the same account-scoped RLS policy as the upload,
 * so a caller can only remove objects under their own account folder.
 *
 * Best-effort: callers fire-and-forget and swallow errors (a missed
 * delete is a storage nit, not something to surface to the user).
 */
export async function deleteAccountMedia(
  bucket: string,
  path: string,
): Promise<void> {
  // Which backend holds it is inferred from the path shape rather than
  // requiring every caller to remember. R2 keys carry the bucket as
  // their first segment (`chat-media/account-<uuid>/...`); Supabase
  // paths start at the account segment because the bucket is a separate
  // argument there. That difference makes objects stored before R2 was
  // switched on still deletable, which matters because we deliberately
  // left existing files on Supabase.
  if (path.startsWith(`${bucket}/`)) {
    const res = await fetch(
      `/api/storage/object?path=${encodeURIComponent(path)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Could not delete the file.");
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(error.message);
}
