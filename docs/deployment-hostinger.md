# Deploy on Hostinger

Hostinger's **[Managed Node.js Hosting](https://www.hostinger.com/web-apps-hosting)**
is the recommended way to run this template in production: Hostinger patches the
OS and the Node runtime, handles SSL, and gives you a Git-based deploy
flow from hPanel. You deploy from your fork without ever opening an SSH
session if you don't want to.

This walkthrough assumes you have already completed
[getting-started](./getting-started.md), [supabase-setup](./supabase-setup.md),
and [whatsapp-setup](./whatsapp-setup.md) — i.e., your fork builds locally
and you have your Supabase + Meta credentials ready.

## 1. Buy a Managed Node.js plan

1. Sign up at <https://www.hostinger.com/web-apps-hosting> and choose a
   Node.js plan that gives you enough memory for `npm run build` (2 GB+
   recommended).
2. During the onboarding wizard, pick the **Node.js** stack and the region
   closest to your users.
3. Finish setup until you land in **hPanel**.

## 2. Create the app in hPanel

In hPanel, open the hosting plan and go to **Websites → Create / Manage**
and pick the **Node.js** application option, then:

- **Application name** — `wacrm`.
- **Application root** — accept the default (e.g., `domains/yourdomain/public_html`).
- **Application URL** — the domain or subdomain you want to use (e.g.,
  `crm.example.com`). You can attach a domain now or later under
  **Domains**.
- **Node.js version** — 20 or newer.
- **Application startup file / command** — Next.js uses `npm start` once
  it is built, so set:
  - Start command: `npm start`
  - Alternatively: `node node_modules/next/dist/bin/next start -p $PORT`

Save the app. hPanel provisions a container and shows you the app's
control page.

## 3. Connect your GitHub fork

In hPanel → **Git**:

1. **Create repository** → paste your fork's HTTPS URL
   (e.g., `https://github.com/<your-username>/wacrm.git`).
2. Pick the branch you want to deploy (usually `main`).
3. Set the deploy path to the **Application root** from step 2.

Alternative: if you prefer ZIP uploads, use **File Manager** instead —
upload the repo contents into the application root. Git-based deploy is
simpler because redeploying is one click.

## 4. Install dependencies and build

hPanel's Node.js app page exposes a **Run NPM install** button and a
terminal. Either works:

- **Button flow**:
  1. Click **Run NPM install**. Wait for it to finish.
  2. Click **Run NPM Build** (or execute `npm run build` from the app
     terminal).
- **Terminal flow**:
  ```bash
  npm ci
  npm run build
  ```

> Next.js expects `NEXT_PUBLIC_*` variables to be present **at build
> time**, so set env vars (step 5) **before** running the build.

## 5. Configure environment variables

In hPanel → **Node.js app → Environment variables**, add every value from
[environment-variables.md](./environment-variables.md):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`
- `META_APP_SECRET`
- `NEXT_PUBLIC_SITE_URL` — set to `https://<your-domain>` (with the
  scheme, without a trailing slash).
- `AUTOMATION_CRON_SECRET` — if you plan to use Wait steps
  ([automations-and-cron.md](./automations-and-cron.md)).

Save, then **re-run the build** so the new `NEXT_PUBLIC_*` values get
baked into the client bundle.

## 6. Start the app

From the app page, click **Restart application** (or run the equivalent
from the terminal). hPanel boots `npm start` behind its own reverse proxy
on the domain you configured. Hit the URL in a browser — you should land
on the marketing page.

SSL is provisioned automatically. If you used a subdomain, Hostinger's
AutoSSL usually takes a minute or two; until then the site may serve the
plain-HTTP version.

## 7. Update the Meta webhook

Back in **Meta for Developers → WhatsApp → Configuration**, change the
callback URL to `https://<your-domain>/api/whatsapp/webhook` and re-verify.

## 8. Schedule the automations cron

If you use the Wait step in any automation, schedule the cron drain.

- **Inside hPanel** — open **Advanced → Cron Jobs** and add:
  ```
  * * * * * curl -s -H "x-cron-secret: <AUTOMATION_CRON_SECRET>" https://<your-domain>/api/automations/cron > /dev/null
  ```
  Paste the literal secret here (cron jobs in hPanel don't read app env
  vars) or store it in a file the cron reads.
- **Outside** — any uptime monitor (UptimeRobot, Better Stack, GitHub
  Actions) can hit the URL once a minute. See
  [automations-and-cron.md](./automations-and-cron.md) for detail.

## 9. Deploying updates

Two options:

- **Click-deploy**: push to your fork, then hit **Pull** in hPanel → Git
  and **Restart application**.
- **Terminal**:
  ```bash
  cd <application-root>
  git pull
  npm ci
  npm run build
  # then restart from the Node.js app page
  ```

If the database schema changed, apply any new SQL files from
`supabase/migrations/` in the Supabase SQL editor first — migrations are
idempotent.

## When to reach for a VPS instead

Managed Node.js covers most deploys of this template. Consider
[Hostinger VPS](https://www.hostinger.com/vps-hosting) if you need:

- Long-running background workers beyond what the single Next.js process
  gives you.
- System-level cron behaviour you can't replicate from hPanel.
- Custom binaries (e.g., ffmpeg) for media transforms.

Otherwise, Managed Node.js is the fast path.

## Where to go next

- [Automations cron →](./automations-and-cron.md) — must-do if you use
  the Wait step in any automation.
- [Troubleshooting →](./troubleshooting.md) — common deploy issues.
