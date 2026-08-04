// Proves a Cloudflare R2 setup actually works, end to end.
//
// The failure modes this catches are all silent ones — the kind where
// uploads appear to succeed and something breaks much later:
//
//   * an API token scoped to the wrong bucket, or read-only
//   * a bucket with no public access, so uploads work and WhatsApp
//     media sends fail (Meta fetches these URLs itself)
//   * a custom domain that hasn't finished propagating
//   * R2_PUBLIC_BASE_URL pointing somewhere that isn't this bucket
//
// It writes one small object, reads it back over the PUBLIC url the way
// Meta would, then deletes it. Nothing else in the bucket is touched.
//
// Run:
//   npm run verify:r2
//
// Requires Node 20.6+ for --env-file (package.json already relies on it
// for the cron runner).

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const REQUIRED = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BASE_URL',
];

const ok = (m) => console.log(`  [32m✓[0m ${m}`);
const bad = (m) => console.log(`  [31m✗[0m ${m}`);
const info = (m) => console.log(`    ${m}`);

let failed = false;
function fail(message, hint) {
  failed = true;
  bad(message);
  if (hint) info(`→ ${hint}`);
}

// ---- 1. Config ------------------------------------------------
console.log('\nR2 configuration');

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  fail(
    `missing: ${missing.join(', ')}`,
    'Add them to .env.local — see .env.local.example for what each one is.',
  );
  console.log('\nCannot continue without those.\n');
  process.exit(1);
}

const bucket = process.env.R2_BUCKET;
const publicBase = process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '');
ok(`bucket "${bucket}"`);
ok(`public base ${publicBase}`);

if (!/^https:\/\//.test(publicBase)) {
  fail(
    'R2_PUBLIC_BASE_URL is not https',
    'Meta refuses to fetch media over plain http, so sends would fail.',
  );
}
if (publicBase.includes('r2.dev')) {
  info(
    '⚠ using the r2.dev address — Cloudflare rate-limits it and advises',
  );
  info('  against production use. A custom domain is safer.');
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Deliberately outside any `account-<uuid>/` folder so it can never be
// mistaken for customer data, and is obvious if cleanup ever fails.
const key = `_verify/${Date.now()}-r2-check.txt`;
const body = `wacrm r2 verification ${new Date().toISOString()}`;

// ---- 2. Write -------------------------------------------------
console.log('\nWrite');
try {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'text/plain',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  ok(`uploaded ${key}`);
} catch (err) {
  fail(
    `upload rejected — ${err.name}: ${err.message}`,
    err.name === 'AccessDenied' || err.name === 'InvalidAccessKeyId'
      ? 'Check the token has "Object Read & Write" AND is scoped to this bucket.'
      : 'Check R2_ACCOUNT_ID and R2_BUCKET match the bucket you created.',
  );
  console.log('\nStopping — nothing was written, nothing to clean up.\n');
  process.exit(1);
}

// ---- 3. Read back with the credentials ------------------------
console.log('\nRead (authenticated)');
try {
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const text = await res.Body.transformToString();
  if (text === body) ok('object reads back correctly');
  else fail('object content did not match what was written');
} catch (err) {
  fail(`could not read it back — ${err.name}`, 'Token may be write-only.');
}

// ---- 4. Read back over the PUBLIC url -------------------------
// This is the one that matters: it is exactly what Meta does when
// sending media, and what a browser does when rendering an image.
console.log('\nRead (public url — what Meta and browsers do)');
const publicUrl = `${publicBase}/${key}`;
info(publicUrl);

let publicOk = false;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const res = await fetch(publicUrl, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      if (text === body) {
        ok(`reachable (HTTP ${res.status})`);
        const ct = res.headers.get('content-type') ?? '';
        const cc = res.headers.get('cache-control') ?? '';
        if (ct.includes('text/plain')) ok(`content-type preserved (${ct})`);
        else info(`⚠ content-type came back as "${ct}"`);
        if (cc.includes('max-age')) ok(`cache-control preserved (${cc})`);
        else info('⚠ no cache-control — files will be re-fetched every view');
        publicOk = true;
      } else {
        fail('public url served different content than we uploaded');
      }
      break;
    }

    if (res.status === 401 || res.status === 403) {
      fail(
        `public url returned ${res.status}`,
        'The bucket is not public. Bucket → Settings → Public access → connect a custom domain. Uploads work without this, but WhatsApp media sends will fail.',
      );
      break;
    }
    if (attempt === 3) {
      fail(
        `public url returned ${res.status}`,
        'Check R2_PUBLIC_BASE_URL points at the domain attached to THIS bucket.',
      );
    } else {
      info(`HTTP ${res.status}, retrying in 3s (domain may still be propagating)…`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  } catch (err) {
    if (attempt === 3) {
      fail(
        `could not reach it — ${err.message}`,
        'DNS may not have propagated yet, or the domain is not attached to the bucket.',
      );
    } else {
      info('connection failed, retrying in 3s (DNS may still be propagating)…');
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// ---- 5. Clean up ----------------------------------------------
console.log('\nCleanup');
try {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  ok('test object deleted');
} catch (err) {
  fail(
    `could not delete the test object — ${err.name}`,
    `Remove ${key} by hand, and check the token allows writes as well as reads.`,
  );
}

// ---- Verdict --------------------------------------------------
console.log('');
if (failed) {
  console.log('[31mR2 is not ready.[0m Fix the items marked ✗ above.\n');
  process.exit(1);
}
if (!publicOk) {
  console.log('[31mR2 is not ready.[0m Public access is not working.\n');
  process.exit(1);
}
console.log(
  '[32mR2 is ready.[0m Restart the dev server and uploads will go to R2.\n',
);
