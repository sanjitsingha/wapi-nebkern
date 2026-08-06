import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { clientIp, isCaptchaConfigured, verifyCaptcha } from '@/lib/captcha';

/**
 * POST /api/contact — the public contact form.
 *
 * Service-role insert rather than an anon-key write from the browser:
 * `contact_submissions` has RLS on with no policies precisely so this
 * route is the only way in, which is what makes the captcha check
 * unavoidable rather than decorative (see migration 083).
 */

const MAX = { name: 120, email: 200, phone: 40, company: 160, message: 4000 };

/** Deliberately loose. Strict email regexes reject valid addresses, and
 *  the address is for a human to reply to, not to authenticate. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function field(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  // Honeypot: a field hidden from people and irresistible to the bots
  // that fill every input they find. Costs nothing and catches the
  // low-effort majority before the captcha round-trip.
  if (field(body.website, 200)) {
    // 200, not 400 — telling a bot it was spotted invites another try
    // with the field left blank.
    return NextResponse.json({ ok: true });
  }

  const name = field(body.name, MAX.name);
  const email = field(body.email, MAX.email).toLowerCase();
  const message = field(body.message, MAX.message);

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: 'Name, email and message are required' },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: 'That email address does not look right' },
      { status: 400 }
    );
  }

  const ok = await verifyCaptcha(
    typeof body.captchaToken === 'string' ? body.captchaToken : undefined,
    clientIp(request)
  );
  if (!ok) {
    return NextResponse.json(
      { error: 'Captcha check failed — please try again' },
      { status: 400 }
    );
  }
  if (!isCaptchaConfigured()) {
    console.warn(
      '[contact] TURNSTILE_* not set — form accepted without a captcha check'
    );
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { error } = await db.from('contact_submissions').insert({
    name,
    email,
    phone: field(body.phone, MAX.phone) || null,
    company: field(body.company, MAX.company) || null,
    message,
    source_path: field(body.sourcePath, 200) || null,
    user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
  });

  if (error) {
    console.error('[contact] insert failed', error.message);
    return NextResponse.json(
      { error: 'Could not send your message. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
