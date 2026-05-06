# Documentation

A self-hostable CRM template for WhatsApp built on Next.js and Supabase.
These docs walk you from a freshly forked repo to a production deploy.

## Reading order

**Setup**

1. **[Getting started](./getting-started.md)** — fork the repo, install, run
   locally.
2. **[Supabase setup](./supabase-setup.md)** — create the database, run the
   migrations, grab the keys.
3. **[WhatsApp setup](./whatsapp-setup.md)** — create a Meta app, connect a
   phone number, wire the webhook.
4. **[Environment variables](./environment-variables.md)** — the full reference.

**Deploy**

5. **[Deploy on Hostinger](./deployment-hostinger.md)** — Managed Node.js
   Hosting walkthrough, the recommended way to ship the template.
6. **[Automations cron](./automations-and-cron.md)** — schedule the pending
   executions drain so waits and delays fire.

**Reference**

7. **[Architecture](./architecture.md)** — stack, folder layout, request
   lifecycle, where to change things.
8. **[Troubleshooting](./troubleshooting.md)** — the usual suspects.

## What you will need before starting

- A GitHub account (to fork the repo).
- A [Supabase](https://supabase.com) project on any paid or free tier.
- A [Meta for Developers](https://developers.facebook.com) account with a
  WhatsApp Business app.
- A WhatsApp phone number that is **not** already tied to the regular
  WhatsApp or WhatsApp Business mobile apps.
- A [Hostinger Managed Node.js Hosting](https://www.hostinger.com/web-apps-hosting)
  plan (or any Node host that runs long-running Node.js 20+ processes).

## Stack at a glance

- **Frontend / API** — Next.js 16 (App Router), React 19, Tailwind v4.
- **Database + auth + storage** — Supabase (Postgres + RLS).
- **WhatsApp transport** — Meta Cloud API (official WhatsApp Business API).
- **Encryption** — AES-256-GCM for per-user WhatsApp access + verify
  tokens at rest. Legacy CBC-encrypted rows self-heal on next use.
- **Scheduler** — cron (or any pinger) that hits `GET /api/automations/cron`.

## Getting help

If something is unclear or broken, open an issue against the source repo:
<https://github.com/ArnasDon/wacrm/issues>.
