# Background jobs & cron

Five features in this app do nothing on their own. Each is an HTTP
endpoint that only does work when something calls it on a schedule:

| Job | Endpoint | Cadence | Without it |
| --- | --- | --- | --- |
| Webhook dispatcher | `/api/webhooks/dispatch` | 60s | Outbound webhooks queue up and never deliver |
| **Broadcast scheduler** | `/api/broadcasts/cron` | 60s | **Scheduled broadcasts never send** |
| Automations engine | `/api/automations/cron` | 60s | Delayed automation steps never resume |
| Flows timeout sweep | `/api/flows/cron` | 5 min | Abandoned chatbot runs stay open forever |
| Account purge | `/api/accounts/cron` | daily | Deleted accounts stay locked but are never actually removed |

The account purge is the one job whose absence is *safe*: without it a
deleted account stays locked and recoverable indefinitely rather than
being erased on time. That is the right way round for a destructive
sweep, but it does mean the 30-day promise in the product copy is only
true while this is scheduled.

They all authenticate the same way: a `x-cron-secret` request header that
must equal `AUTOMATION_CRON_SECRET` in the server's environment.

- Header missing or wrong → **401**
- `AUTOMATION_CRON_SECRET` unset **on the server** → **503 "cron not configured"**

## Setup

**1. Set the secret** in every environment that runs the app (and in the
scheduler). Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**2. Point a scheduler at all four URLs.** Any of these works — pick one:

<details>
<summary>Server crontab (Hostinger / any VPS)</summary>

```cron
* * * * * curl -fsS -H "x-cron-secret: $AUTOMATION_CRON_SECRET" https://your-domain.com/api/webhooks/dispatch  >/dev/null
* * * * * curl -fsS -H "x-cron-secret: $AUTOMATION_CRON_SECRET" https://your-domain.com/api/broadcasts/cron    >/dev/null
* * * * * curl -fsS -H "x-cron-secret: $AUTOMATION_CRON_SECRET" https://your-domain.com/api/automations/cron   >/dev/null
*/5 * * * * curl -fsS -H "x-cron-secret: $AUTOMATION_CRON_SECRET" https://your-domain.com/api/flows/cron       >/dev/null
17 3 * * *  curl -fsS -H "x-cron-secret: $AUTOMATION_CRON_SECRET" https://your-domain.com/api/accounts/cron    >/dev/null
```

</details>

<details>
<summary>cron-job.org / EasyCron / UptimeRobot</summary>

One job per URL. Add a custom request header `x-cron-secret` with the
secret as its value. A 1-minute interval for the first three, 5 minutes
for flows.
</details>

<details>
<summary>Vercel Cron (vercel.json)</summary>

Vercel Cron cannot send custom headers — it sends `Authorization: Bearer
$CRON_SECRET` instead. The routes would need to accept that too before
this option works.
</details>

**3. Verify it's actually running.** Admin → System Health lists every
job with its last run and a rolling run count, read from
`system_cron_heartbeats`. A job with **no row at all has never once
run** — that is the signature of a scheduler that was never wired up,
not of a job that is failing.

## Local development

```bash
npm run cron
```

Pings all four against `http://localhost:3000` on a 60s loop, reading the
secret from `.env.local`. Only non-idle runs print, so a quiet console
means "nothing was due", not "broken".

Target another host with `BASE_URL=https://your-domain.com npm run cron` —
but the secret in `.env.local` must then match that server's.

`npm run webhooks:cron` is the older, narrower script: it pings the
webhook queue *only*. Prefer `npm run cron`.

## Gotcha: a due broadcast fires the moment cron comes alive

The broadcast sweep selects `status = 'scheduled' AND scheduled_at <=
now()` — with no lower bound on how far in the past. Wiring up cron after
a gap will therefore immediately send every broadcast that came due
during that gap, however old. Check for stragglers before you start the
scheduler:

```sql
SELECT id, name, scheduled_at, total_recipients
FROM broadcasts
WHERE status = 'scheduled' AND scheduled_at <= now();
```

Move any you don't want to go out back to `'draft'` first — the sweep only
looks at `'scheduled'`, and a draft stays editable so you can reschedule
it properly:

```sql
UPDATE broadcasts SET status = 'draft'
WHERE status = 'scheduled' AND scheduled_at <= now();
```

There is deliberately no `'cancelled'` value: the `broadcasts.status`
CHECK constraint (migration 001) allows only `draft`, `scheduled`,
`sending`, `sent`, `failed`, and `'draft'` already means "not scheduled,
not sent". Using `'failed'` instead would work but reads as a send that
went wrong rather than one that was called off.
