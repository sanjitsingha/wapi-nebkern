import { NextResponse, after } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { verifyUnsubscribe } from '@/lib/newsletter-unsubscribe';
import { sendMailQuietly } from '@/lib/email/deomail';
import { goodbyeEmail } from '@/lib/email/newsletter-templates';

/**
 * POST /api/newsletter/unsubscribe — { email, token }
 *
 * POST, not GET, and reached from a confirm button rather than the link
 * itself. Corporate mail scanners and link-preview bots fetch every URL
 * in an incoming message; a GET that unsubscribes on load would remove
 * people who never opened the email, and they would never know why they
 * stopped hearing from us.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    token?: unknown;
  } | null;

  const email =
    typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const token = typeof body?.token === 'string' ? body.token.trim() : '';

  if (!verifyUnsubscribe(email, token)) {
    return NextResponse.json(
      { error: 'That unsubscribe link is not valid' },
      { status: 400 }
    );
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { error } = await db
    .from('newsletter_subscribers')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('email', email);

  if (error) {
    console.error('[newsletter] unsubscribe failed', error.message);
    return NextResponse.json(
      { error: 'Could not unsubscribe you. Please try again.' },
      { status: 500 }
    );
  }

  // Confirmation that it worked, sent after the response for the same
  // reason as the welcome: the opt-out has already been recorded and no
  // mail failure should undo or delay that.
  //
  // Worth sending even though they asked to stop hearing from us — this
  // is the receipt for the request, not more newsletter, and without it
  // the only proof the click worked is a page they have already closed.
  after(async () => {
    const mail = goodbyeEmail(email);
    await sendMailQuietly(
      { from: 'newsletter', to: email, ...mail },
      `goodbye to ${email}`
    );
  });

  // Deliberately not reporting whether the address was on the list.
  // A signed link proves the holder owns the address, but echoing
  // "you were not subscribed" still turns this into a way to test
  // membership, and there is nothing useful the person could do with
  // the distinction anyway.
  return NextResponse.json({ ok: true });
}
