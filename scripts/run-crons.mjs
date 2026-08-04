// Local "mailman" for every background job.
//
// The app has four cron endpoints and none of them run themselves. Each
// one does nothing until something hits it on a schedule with the shared
// `x-cron-secret` header — a scheduled broadcast whose time arrives sits
// at status='scheduled' forever if nobody pings /api/broadcasts/cron.
//
// This is the superset of scripts/dispatch-webhooks.mjs (which only ever
// pinged the webhook queue). Prefer this one — running the old script
// alone leaves broadcasts, automations and flows dead.
//
// Run it (Node 20.6+, reads AUTOMATION_CRON_SECRET from .env.local):
//   npm run cron
//
// Override the target / cadence with env vars:
//   BASE_URL=https://your-domain.com  CRON_INTERVAL_MS=60000  npm run cron
//
// PRODUCTION: don't run this script — point a real scheduler (crontab,
// cron-job.org, Vercel Cron, a systemd timer) at each URL below with the
// same header. See docs/automations-and-cron.md.

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const INTERVAL_MS = Number(process.env.CRON_INTERVAL_MS ?? 60_000);
const SECRET = process.env.AUTOMATION_CRON_SECRET;

if (!SECRET) {
  console.error(
    'AUTOMATION_CRON_SECRET is not set. Add it to .env.local, then:\n' +
      '  npm run cron',
  );
  process.exit(1);
}

const base = BASE_URL.replace(/\/$/, '');

// `everyTicks` throttles the jobs that don't need minute precision, so a
// 60s loop doesn't hammer the flow-timeout sweep pointlessly.
//
// These cadences are a running cost even with zero activity: each tick
// is a due-work scan plus a liveness heartbeat, around the clock,
// whether or not anyone is using the app. They are tuned to how much
// lateness each job can actually tolerate:
//
//   webhooks    every minute — an integration delivery queue; latency
//                here is visible to whatever the customer wired up.
//   broadcasts  every 2 min  — a scheduled campaign landing up to two
//                minutes after its slot is not a product regression.
//   automations every 2 min  — same reasoning; the waits these resume
//                are minutes-to-days long.
//   flows       every 15 min — a timeout sweep for abandoned chatbot
//                runs, whose deadlines are measured in hours.
//
// KEEP IN STEP with KNOWN_CRONS in src/lib/system/cron-heartbeat.ts —
// its `intervalSeconds` drives the admin System Health console's
// "overdue" detection, so a cadence change here without a change there
// makes every job look dead.
const JOBS = [
  { key: 'webhooks', path: '/api/webhooks/dispatch', everyTicks: 1 },
  { key: 'broadcasts', path: '/api/broadcasts/cron', everyTicks: 2 },
  { key: 'automations', path: '/api/automations/cron', everyTicks: 2 },
  { key: 'flows', path: '/api/flows/cron', everyTicks: 15 },
];

let tick = 0;

/** One-line summary of whatever shape a given cron route returns. */
function summarize(body) {
  if (body == null || typeof body !== 'object') return '';
  for (const k of ['dispatched', 'processed', 'resumed', 'swept', 'timedOut']) {
    if (typeof body[k] === 'number' && body[k] > 0) return `${k}=${body[k]}`;
  }
  return 'idle';
}

async function run(job) {
  const url = `${base}${job.path}`;
  const stamp = new Date().toLocaleTimeString();
  try {
    const res = await fetch(url, { headers: { 'x-cron-secret': SECRET } });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      console.error(
        `[${stamp}] ${job.key}: 401 — AUTOMATION_CRON_SECRET here does not match the server's.`,
      );
    } else if (res.status === 503) {
      console.error(
        `[${stamp}] ${job.key}: 503 — the SERVER has no AUTOMATION_CRON_SECRET set.`,
      );
    } else if (!res.ok) {
      console.error(`[${stamp}] ${job.key}: HTTP ${res.status}`, body);
    } else {
      const s = summarize(body);
      if (s !== 'idle') console.log(`[${stamp}] ${job.key}: ${s}`);
    }
  } catch (err) {
    console.error(`[${stamp}] ${job.key}: unreachable — ${err.message}`);
  }
}

async function sweep() {
  tick += 1;
  await Promise.all(JOBS.filter((j) => tick % j.everyTicks === 0).map(run));
}

console.log(
  `Cron runner → ${base} every ${INTERVAL_MS / 1000}s\n` +
    JOBS.map((j) => `  ${j.path}${j.everyTicks > 1 ? ` (every ${j.everyTicks} ticks)` : ''}`).join('\n') +
    '\nOnly non-idle runs are logged. Ctrl+C to stop.',
);
await sweep();
setInterval(sweep, INTERVAL_MS);
