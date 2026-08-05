// ============================================================
// Cloudflare R2 — object storage for everything users upload.
//
// SERVER ONLY. R2 credentials are full read/write on the bucket and
// have no equivalent of Supabase's row-level security, so they must
// never reach the browser. Importing this from a client component is a
// mistake — see `presignUpload` for how the browser uploads without
// ever seeing a key.
//
// WHY R2 AT ALL
//
// Supabase's free tier meters egress at 5 GB/month, and every image
// view came out of it: uploads were served straight from Supabase
// Storage public URLs. R2 charges nothing for egress, ever — that is
// its entire reason to exist — so moving uploads here takes image
// traffic off the metered budget completely rather than merely
// reducing it.
//
// OPTIONAL BY DESIGN
//
// This is a self-hostable project (MIT, see package.json). A hard R2
// dependency would break every deployment that hasn't got a Cloudflare
// account. When the env vars below are absent, `isR2Configured()`
// returns false and the upload helpers fall back to Supabase Storage,
// behaving exactly as they did before. Nothing here is required.
// ============================================================

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * How long a presigned upload link stays valid. Long enough for a
 * 16 MB file on a slow connection, short enough that a leaked link is
 * worthless by the time anyone finds it.
 */
const UPLOAD_URL_TTL_SECONDS = 10 * 60;

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public origin the objects are served from, no trailing slash. */
  publicBaseUrl: string;
}

function readConfig(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucket ||
    !publicBaseUrl
  ) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ''),
  };
}

/** True when every R2 env var is set. Callers fall back to Supabase
 *  Storage when this is false. */
export function isR2Configured(): boolean {
  return readConfig() !== null;
}

let cachedClient: S3Client | null = null;

function client(config: R2Config): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    // R2 speaks the S3 protocol, so the standard AWS client works —
    // it just needs pointing at Cloudflare instead of Amazon. The
    // region is a required field that R2 ignores; 'auto' is what
    // Cloudflare's own docs use.
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return cachedClient;
}

/** Public URL an object is served from. This is the address stored in
 *  the database and the one Meta fetches when sending media, so it must
 *  be reachable from the public internet. */
export function r2PublicUrl(path: string): string {
  const config = readConfig();
  if (!config) throw new Error('R2 is not configured');
  return `${config.publicBaseUrl}/${path}`;
}

/**
 * Mint a short-lived link the browser can PUT a file to directly.
 *
 * Direct-to-R2 rather than proxying through an API route on purpose:
 * routing a 16 MB upload through the app would burn the host's
 * bandwidth twice and run into the ~4.5 MB request-body ceiling most
 * serverless platforms impose. This way the bytes go straight from the
 * user to Cloudflare, and the only thing our server hands out is a
 * time-limited permission slip for one specific object path.
 *
 * `contentType` is baked into the signature: the browser must send
 * exactly this Content-Type or R2 rejects the PUT, so a link minted for
 * an image cannot be reused to upload something else.
 */
export async function presignUpload(
  path: string,
  contentType: string,
): Promise<string> {
  const config = readConfig();
  if (!config) throw new Error('R2 is not configured');

  return getSignedUrl(
    client(config),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: path,
      ContentType: contentType,
      // Long cache: these objects are immutable — every upload gets a
      // timestamped path, so a given URL's bytes never change.
      CacheControl: 'public, max-age=31536000, immutable',
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );
}

/**
 * Write an object from the server.
 *
 * The counterpart to `presignUpload`: that one exists so a BROWSER can
 * upload without our credentials, this one is for bytes the server
 * already holds — inbound WhatsApp media, which arrives from Meta and is
 * cached here so it is only ever fetched from Meta once.
 */
export async function putR2Object(
  path: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const config = readConfig();
  if (!config) throw new Error('R2 is not configured');

  await client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: path,
      Body: body,
      ContentType: contentType,
      // Immutable: the key contains Meta's media id, which identifies
      // exactly one file forever.
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

/** Remove an object. Used to GC media that was staged but never sent. */
export async function deleteR2Object(path: string): Promise<void> {
  const config = readConfig();
  if (!config) throw new Error('R2 is not configured');

  await client(config).send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: path }),
  );
}
