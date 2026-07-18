// Local "mailman" for the outbound webhook queue.
//
// Pings the dispatch endpoint on a loop so queued webhook deliveries
// (message.received, contact.created, …) actually get sent while you
// develop/test. In production you'd instead point a scheduler
// (Vercel Cron, cron-job.org, a server crontab) at the same endpoint.
//
// Run it (Node 20.6+, reads AUTOMATION_CRON_SECRET from .env.local):
//   npm run webhooks:cron
//
// Override the target / cadence with env vars:
//   BASE_URL=http://localhost:3000  DISPATCH_INTERVAL_MS=30000

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const INTERVAL_MS = Number(process.env.DISPATCH_INTERVAL_MS ?? 30_000);
const SECRET = process.env.AUTOMATION_CRON_SECRET;
const URL = `${BASE_URL.replace(/\/$/, '')}/api/webhooks/dispatch`;

if (!SECRET) {
  console.error(
    'AUTOMATION_CRON_SECRET is not set. Add it to .env.local and run with:\n' +
      '  node --env-file=.env.local scripts/dispatch-webhooks.mjs',
  );
  process.exit(1);
}

async function tick() {
  try {
    const res = await fetch(URL, { headers: { 'x-cron-secret': SECRET } });
    const body = await res.json().catch(() => ({}));
    const stamp = new Date().toLocaleTimeString();
    if (!res.ok) {
      console.error(`[${stamp}] HTTP ${res.status}`, body);
    } else if (body.processed) {
      console.log(
        `[${stamp}] sent ${body.success}/${body.processed} (failed ${body.failed})`,
      );
    } else {
      console.log(`[${stamp}] nothing due`);
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] unreachable:`, err.message);
  }
}

console.log(`Webhook mailman → ${URL} every ${INTERVAL_MS / 1000}s. Ctrl+C to stop.`);
await tick();
setInterval(tick, INTERVAL_MS);
