// ============================================================
// Shrink an image in the browser before it is uploaded.
//
// WHY ONLY IMAGES
//
// Video, audio and documents cannot be meaningfully re-encoded in a
// browser without shipping something like ffmpeg.wasm — tens of
// megabytes of WebAssembly, and slow enough that the user would sit
// watching a spinner longer than the upload itself takes. Images are
// where the volume is anyway, and where a canvas re-encode is close to
// free.
//
// Voice notes are already compressed: the recorder captures Opus.
//
// DELIBERATELY GENTLE
//
// The goal is "somewhat smaller", not "as small as possible". Two
// reasons to keep quality high:
//
//   1. WhatsApp re-compresses images itself on delivery. Compressing
//      hard here means the recipient sees something that has been
//      through two lossy passes.
//   2. These are business conversations — invoices, prescriptions,
//      product photos, screenshots of error messages. A soft, artefacted
//      image that cannot be read is worse than a large one.
//
// So: cap the longest edge, re-encode at high quality, and keep the
// original whenever the "compressed" version is not actually smaller.
// ============================================================

/**
 * Longest edge, in pixels. Generous on purpose — 1920 is still full HD,
 * readable when zoomed, and well beyond what any chat bubble or preview
 * displays. Most phone photos arrive at 3000-4000px, so this alone does
 * most of the work.
 */
const MAX_EDGE = 1920;

/** JPEG quality. 0.82 is visually near-indistinguishable from source at
 *  normal viewing sizes while typically halving the file. */
const JPEG_QUALITY = 0.82;

/** Below this, do not bother — the saving cannot justify the decode. */
const MIN_BYTES_TO_TRY = 300 * 1024;

/**
 * Formats worth attempting, and nothing else.
 *
 * GIF is excluded because a canvas re-encode keeps only the first frame,
 * silently turning an animation into a still. SVG is excluded because it
 * is text — rasterising it would make it larger and lose its scaling.
 * WebP and HEIC are left alone: already efficient, and re-encoding risks
 * a format Meta may not accept.
 */
const COMPRESSIBLE = new Set(['image/jpeg', 'image/jpg', 'image/png']);

/**
 * Returns a smaller version of `file`, or the original when shrinking it
 * is impossible, pointless, or would make it worse.
 *
 * Never throws: compression is an optimisation, and failing to shrink an
 * attachment must never stop someone sending it. Any error returns the
 * original.
 */
export async function compressImage(file: File): Promise<File> {
  if (typeof window === 'undefined') return file;
  if (!COMPRESSIBLE.has(file.type.toLowerCase())) return file;
  if (file.size < MIN_BYTES_TO_TRY) return file;

  try {
    // `imageOrientation: 'from-image'` matters: a canvas ignores EXIF
    // rotation, so without it every photo taken in portrait on a phone
    // would arrive on its side.
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });

    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    // Keep the original format. Converting PNG to JPEG would shrink more
    // but flattens transparency to black, and converting to WebP risks a
    // type Meta will not accept for a WhatsApp image. Not worth it.
    const isPng = file.type.toLowerCase() === 'image/png';
    const mime = isPng ? 'image/png' : 'image/jpeg';

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, isPng ? undefined : JPEG_QUALITY),
    );
    if (!blob) return file;

    // Re-encoding a photograph as PNG regularly makes it BIGGER, and a
    // small JPEG can round up too. Only keep a genuinely smaller result.
    if (blob.size >= file.size) return file;

    return new File([blob], file.name, {
      type: mime,
      lastModified: file.lastModified,
    });
  } catch {
    // Unsupported codec, out of memory on a huge image, a browser
    // without createImageBitmap options — all fine, just upload as-is.
    return file;
  }
}
