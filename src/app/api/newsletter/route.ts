import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { clientIp, isCaptchaConfigured, verifyCaptcha } from '@/lib/captcha';

/**
 * POST /api/newsletter — email, name optional.
 *
 * Same shape as /api/contact and for the same reason: RLS on the table
 * has no policies, so a service-role write behind a captcha is the only
 * way a row gets in.
 */

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

  if (field(body.website, 200)) return NextResponse.json({ ok: true });

  const email = field(body.email, 200).toLowerCase();
  const name = field(body.name, 120);

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
      '[newsletter] TURNSTILE_* not set — signup accepted without a captcha check'
    );
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Upsert, so signing up twice is a no-op rather than an error the
  // visitor has to interpret. A previously unsubscribed address coming
  // back through the form is re-subscribing on purpose, so the status
  // is reset with it.
  const { error } = await db.from('newsletter_subscribers').upsert(
    {
      email,
      name: name || null,
      status: 'subscribed',
      unsubscribed_at: null,
      source_path: field(body.sourcePath, 200) || null,
    },
    { onConflict: 'email' }
  );

  if (error) {
    console.error('[newsletter] upsert failed', error.message);
    return NextResponse.json(
      { error: 'Could not sign you up. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
