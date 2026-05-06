# Troubleshooting

The greatest hits. If your problem is not here, open an issue at
<https://github.com/ArnasDon/wacrm/issues>.

## Build-time

### `Error: ENCRYPTION_KEY must be 64 hex chars`

`ENCRYPTION_KEY` is missing or not the right length. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the output into `.env.local` / your production env.

### `Error: supabaseUrl is required`

`NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is not set
at build time. On Hostinger / any Node host, make sure the env vars are
exported **before** `npm run build` runs.

### Next.js complains about missing framework docs

The repo's `AGENTS.md` pins contributors to the docs bundled in
`node_modules/next/dist/docs/` — that notice is for humans editing the
code, it does not affect your build.

## Auth

### Sign-up succeeds but the confirmation email never arrives

In Supabase → **Authentication → Providers → Email**, either:

- Configure a custom SMTP provider (recommended for production), or
- Temporarily turn off **Confirm email** while testing.

### Password-reset links point at `localhost:3000` in production

Set `NEXT_PUBLIC_SITE_URL` **and** add the same origin to Supabase →
**Authentication → URL Configuration → Redirect URLs**.

## WhatsApp

### Webhook verification fails in Meta

- The **verify token** in Meta must match exactly what you saved in
  **Settings → WhatsApp** inside the app.
- The callback URL must be reachable without auth. Test it yourself:
  `curl 'https://crm.example.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=test'`
  should return `test`.
- `META_APP_SECRET` must be set on the deployment (it's required —
  without it, every inbound POST gets a 401). If it's set but wrong,
  you'll also see 401s for every POST while the initial subscribe
  handshake (which doesn't use it) works. Double-check the value
  matches Meta → App Settings → Basic → App Secret exactly.

### Messages go out but nothing comes in

1. Confirm the webhook is **Subscribed** to `messages` under Meta →
   WhatsApp → Configuration.
2. Confirm the phone number is listed under **Recipients** during testing
   (test-number apps only deliver to whitelisted testers).
3. Check server logs — inbound webhooks hit
   `POST /api/whatsapp/webhook`. A 200 with no message row means the
   payload parsed successfully but didn't match any known contact's
   config — double-check `phone_number_id`.

### `Token decryption failed`

`ENCRYPTION_KEY` changed since the token was saved. Reconnect the
WhatsApp account from **Settings → WhatsApp** to re-encrypt with the
current key.

## Automations

### Wait steps never resume

The cron drain is not running. See
[automations-and-cron.md](./automations-and-cron.md).

Quick sanity check from your machine:

```bash
curl -s -H "x-cron-secret: <secret>" https://crm.example.com/api/automations/cron
```

If that returns `{"processed":N}` with N growing when a wait is due, the
endpoint is fine and the problem is just the schedule.

### An automation fires twice for the same message

Most likely two app instances share one Supabase project and both
receive the same webhook. The webhook handler deduplicates by Meta's
`wamid`, but only within a single deploy — split-brain setups can double
up. Either consolidate to one deploy or route the webhook to exactly one.

## Deploy

### `502 Bad Gateway` or "Application not running" from Hostinger

- Open the Node.js app page in hPanel and confirm the status is **Started**.
- Check the app log viewer for a crash on boot — almost always a missing
  env var. Re-save your env vars, re-run the build, and restart.
- Confirm the **Application startup command** is `npm start` (or
  equivalent) and that a build has actually run (`.next/` exists in the
  application root).

### Env var changes don't take effect in the browser

`NEXT_PUBLIC_*` values are baked into the client bundle at build time.
After changing any of them, re-run `npm run build` (hPanel's **Run NPM
Build** button works) and restart the app.

### Meta webhook suddenly stops after a domain change

Hostinger provisions a new SSL certificate when you attach a new domain
or subdomain. Until it is issued, the webhook URL serves plain HTTP and
Meta rejects it. Wait for AutoSSL to complete (minutes), then re-verify
the webhook in Meta.

## Still stuck?

Open an issue with:

- Environment (local / Hostinger Managed Node.js / other).
- The exact error from the app log viewer in hPanel or Next's dev output.
- What you were trying to do when it happened.
