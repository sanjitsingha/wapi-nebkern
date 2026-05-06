# Automations cron

The **Automations** module lets you build flows that react to WhatsApp
events (new message, new contact, keyword match, schedule, etc.). Most
steps run inline — the exception is the **Wait** step, which parks the
execution in `automation_pending_executions` until its due time.

A cron job has to drain that table. If you skip this, Wait steps never
resume and any flow that uses them stalls.

## The endpoint

```
GET /api/automations/cron
Header: x-cron-secret: <AUTOMATION_CRON_SECRET>
```

- Returns `{ "processed": <n> }` with how many rows were claimed.
- Returns `503` if the env var is not set.
- Returns `401` if the header is missing or wrong.

The route claims up to 50 pending rows per call via a two-step
UPDATE-by-id so overlapping calls don't double-process.

## 1. Generate the secret

Any long random string works. One option:

```bash
openssl rand -hex 32
```

Copy the result into `AUTOMATION_CRON_SECRET` in your deployment env.

## 2. Schedule the pinger

### Option A — hPanel cron (Hostinger Managed Node.js)

hPanel → **Advanced → Cron Jobs** → add a new job set to every minute
(`* * * * *`). Command:

```
curl -s -H "x-cron-secret: <AUTOMATION_CRON_SECRET>" https://crm.example.com/api/automations/cron > /dev/null
```

Paste the literal secret — hPanel cron jobs don't inherit the Node app's
environment variables.

### Option B — external pinger

Any uptime monitor that supports custom headers works:

- [UptimeRobot](https://uptimerobot.com) — "Keyword Monitoring" with
  custom HTTP headers.
- [Better Stack](https://betterstack.com).
- GitHub Actions with a `schedule:` trigger.

Hit the URL once per minute. Anything slower just means Wait-step
resolution is that much more delayed.

## 3. Verify

```bash
curl -s -H "x-cron-secret: <secret>" https://crm.example.com/api/automations/cron
# -> {"processed":0}
```

Then create a test automation with a short Wait step (e.g., 30 seconds)
and trigger it. Watch the automation's **Logs** tab — the execution
should resume and mark as completed within one cron interval of the wait
expiring.

## 4. What if you don't use Wait?

Skip this page. Trigger → inline steps → done flows do not need a cron —
they finish synchronously inside the webhook handler or from the UI. The
cron only matters for flows that park execution.
