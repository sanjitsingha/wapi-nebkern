// ============================================================
// Screenshots for /docs, taken from the demo workspace.
//
//   node --env-file=.env.local scripts/docs-demo/seed.mjs         # once
//   node --env-file=.env.local scripts/docs-demo/screenshots.mjs   # any time
//
// Signs in as the demo user (DOCS_DEMO_EMAIL / DOCS_DEMO_PASSWORD in
// .env.local) against BASE_URL (default http://localhost:3000, a dev
// server) and writes public/images/docs/<page>/<shot>.webp at the same
// size and theme every time, so re-running after a UI change just
// refreshes them. `ONLY=inbox,contacts` takes just those.
// ============================================================

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const EMAIL = process.env.DOCS_DEMO_EMAIL?.trim();
const PASSWORD = process.env.DOCS_DEMO_PASSWORD?.trim();
// The docs' own convention: public/images/docs/<docs page>/<shot>.webp
const OUT = 'public/images/docs';
const ONLY = (process.env.ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);

if (!EMAIL || !PASSWORD) {
  console.error('Run scripts/docs-demo/seed.mjs first: it puts the demo login in .env.local.');
  process.exit(1);
}

/** Settle: network quiet, then a beat for fonts and animations. */
async function settle(page, ms = 800) {
  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function open(page, path) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await settle(page);
}

/** Save the page (or one element) as WebP. */
async function shoot(page, name, target) {
  const png = target
    ? await page.locator(target).first().screenshot({ animations: 'disabled' })
    : await page.screenshot({ animations: 'disabled' });
  mkdirSync(dirname(`${OUT}/${name}`), { recursive: true });
  await sharp(png).webp({ quality: 82 }).toFile(`${OUT}/${name}.webp`);
  console.log(`  ${name}.webp`);
}

// Each shot: a name (the file), and what to do before taking it.
const SHOTS = [
  { name: 'dashboard', run: async (page) => { await open(page, '/dashboard'); await shoot(page, 'getting-started/dashboard'); } },
  { name: 'inbox', run: async (page) => { await open(page, '/inbox'); await shoot(page, 'inbox'); } },
  { name: 'contacts', run: async (page) => { await open(page, '/contacts'); await shoot(page, 'contacts'); } },
  { name: 'segments', run: async (page) => { await open(page, '/segments'); await shoot(page, 'segments'); } },
  { name: 'lists', run: async (page) => { await open(page, '/lists'); await shoot(page, 'lists'); } },
  { name: 'pipelines', run: async (page) => { await open(page, '/pipelines'); await shoot(page, 'pipelines'); } },
  { name: 'campaigns', run: async (page) => { await open(page, '/campaigns'); await shoot(page, 'campaigns'); } },
  { name: 'broadcasts', run: async (page) => { await open(page, '/broadcasts'); await shoot(page, 'broadcasts'); } },
  { name: 'templates', run: async (page) => { await open(page, '/templates'); await shoot(page, 'templates'); } },
  { name: 'media', run: async (page) => { await open(page, '/media'); await shoot(page, 'media'); } },
  { name: 'automations', run: async (page) => { await open(page, '/automations'); await shoot(page, 'automations'); } },
  { name: 'flows', run: async (page) => { await open(page, '/flows'); await shoot(page, 'flows'); } },
  { name: 'forms', run: async (page) => { await open(page, '/forms'); await shoot(page, 'forms'); } },
  { name: 'calls', run: async (page) => { await open(page, '/calls'); await shoot(page, 'calls'); } },
  { name: 'maya', run: async (page) => { await open(page, '/askmaya'); await shoot(page, 'maya'); } },
  { name: 'maya-configuration', run: async (page) => { await open(page, '/askmaya/configuration'); await shoot(page, 'maya-configuration'); } },
  { name: 'maya-personalization', run: async (page) => { await open(page, '/askmaya/personalization'); await shoot(page, 'maya-personalization'); } },
  { name: 'maya-knowledge', run: async (page) => { await open(page, '/askmaya/knowledge-base'); await shoot(page, 'maya-knowledge'); } },
  { name: 'maya-playground', run: async (page) => { await open(page, '/askmaya/playground'); await shoot(page, 'maya-playground'); } },
  { name: 'settings-profile', run: async (page) => { await open(page, '/settings/profile'); await shoot(page, 'settings-profile'); } },
  { name: 'settings-business', run: async (page) => { await open(page, '/settings/business-profile'); await shoot(page, 'settings-business'); } },
  { name: 'settings-members', run: async (page) => { await open(page, '/settings/members'); await shoot(page, 'settings-members'); } },
  { name: 'settings-tags', run: async (page) => { await open(page, '/settings/tags'); await shoot(page, 'settings-tags'); } },
  { name: 'settings-fields', run: async (page) => { await open(page, '/settings/custom-fields'); await shoot(page, 'settings-fields'); } },
  { name: 'settings-whatsapp', run: async (page) => { await open(page, '/settings/whatsapp'); await shoot(page, 'settings-whatsapp'); } },
  { name: 'settings-instagram', run: async (page) => { await open(page, '/settings/instagram'); await shoot(page, 'settings-instagram'); } },
  { name: 'settings-messenger', run: async (page) => { await open(page, '/settings/messenger'); await shoot(page, 'settings-messenger'); } },
  { name: 'settings-integrations', run: async (page) => { await open(page, '/settings/integrations'); await shoot(page, 'settings-integrations'); } },
  { name: 'settings-hubspot', run: async (page) => { await open(page, '/settings/integrations/hubspot'); await shoot(page, 'settings-hubspot'); } },
  { name: 'settings-api', run: async (page) => { await open(page, '/settings/api-access'); await shoot(page, 'settings-api'); } },
  { name: 'settings-billing', run: async (page) => { await open(page, '/settings/billing'); await shoot(page, 'settings-billing'); } },
  { name: 'settings-security', run: async (page) => { await open(page, '/settings/security'); await shoot(page, 'settings-security'); } },
  { name: 'settings-widget', run: async (page) => { await open(page, '/settings/widget'); await shoot(page, 'settings-widget'); } },
  { name: 'settings-activity', run: async (page) => { await open(page, '/settings/activity-log'); await shoot(page, 'settings-activity'); } },
];

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
  locale: 'en-IN',
  timezoneId: 'Asia/Kolkata',
});
// Before any page script: the cookie question already answered (no
// popup, no analytics from the demo), and the dev-only Next.js badge
// and the "connect WhatsApp" bar (the demo has no number) hidden.
await context.addInitScript(() => {
  try {
    localStorage.setItem('wacrm:cookie-consent', 'declined');
  } catch {}
  const add = () => {
    const style = document.createElement('style');
    style.textContent =
      'nextjs-portal{display:none!important}[data-slot="whatsapp-connect-banner"]{display:none!important}';
    document.documentElement.appendChild(style);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add);
  else add();
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await page.fill('#email', EMAIL);
await page.fill('#password', PASSWORD);
await page.keyboard.press('Enter');
await page.waitForURL(/\/dashboard/, { timeout: 180_000 });

for (const shot of SHOTS) {
  if (ONLY.length && !ONLY.includes(shot.name)) continue;
  try {
    await shot.run(page);
  } catch (err) {
    console.error(`  ${shot.name} failed: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
  }
}
if (errors.length) console.error(`Page errors:\n  ${[...new Set(errors)].join('\n  ')}`);
await browser.close();
