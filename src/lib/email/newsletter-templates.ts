import { unsubscribeUrl } from '@/lib/newsletter-unsubscribe';

/**
 * The two newsletter emails: welcome on signup, confirmation on the way
 * out.
 *
 * Written as inline-styled tables rather than anything clever. Email
 * clients are not browsers — Gmail strips <style> blocks, Outlook
 * renders through Word, and flexbox/grid are not available. Inline
 * styles on tables is the only layout that survives all of them.
 *
 * Every template returns html AND text. A missing text/plain part reads
 * as spam to most filters, and some people genuinely read mail in
 * plain text.
 */

/**
 * Read at call time, not module load.
 *
 * `unsubscribeUrl` in newsletter-unsubscribe.ts resolves the same env
 * var per call, and having one of them freeze at import while the other
 * doesn't is how a template ends up with two different base URLs in the
 * same email. It also makes the module impossible to test without
 * controlling import order.
 */
function site(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://instant.nebkern.com'
  ).replace(/\/$/, '');
}

/** The brand green, as a literal. Emails cannot read CSS variables. */
const GREEN = '#0b6623';
const INK = '#191826';
const SOFT = '#5c5a70';

function shell(bodyHtml: string, footerHtml: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f5f5f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="padding-bottom:20px;">
          <span style="font-size:18px;font-weight:700;color:${GREEN};letter-spacing:-0.01em;">Instant</span>
        </td></tr>
        <tr><td style="font-size:15px;line-height:1.6;color:${INK};">${bodyHtml}</td></tr>
        <tr><td style="padding-top:28px;border-top:1px solid #e7e5e4;font-size:12px;line-height:1.6;color:${SOFT};">
          ${footerHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px;">${label}</a>`;
}

export function welcomeEmail(email: string, name?: string | null) {
  // The unsubscribe link is not decoration. Every bulk email needs a
  // one-click way out, and burying it is how a list ends up reported as
  // spam instead of unsubscribed from.
  const optOut = unsubscribeUrl(email);
  const greeting = name?.trim() ? `Hi ${name.trim()},` : 'Hi,';

  return {
    subject: "You're on the list",
    html: shell(
      `<p style="margin:0 0 14px;">${greeting}</p>
       <p style="margin:0 0 14px;">Thanks for subscribing to the Instant newsletter. We write about WhatsApp marketing, automation, and what we're building — occasionally, and only when there's something worth your time.</p>
       <p style="margin:0 0 24px;">Nothing else to do. The next one will just arrive.</p>
       <p style="margin:0;">${button(`${site()}/blog`, 'Read the blog')}</p>`,
      `You're receiving this because ${email} was entered at ${site()}.<br>
       <a href="${optOut}" style="color:${SOFT};">Unsubscribe</a>`
    ),
    text: `${greeting}

Thanks for subscribing to the Instant newsletter. We write about WhatsApp
marketing, automation, and what we're building — occasionally, and only
when there's something worth your time.

Nothing else to do. The next one will just arrive.

Read the blog: ${site()}/blog

---
You're receiving this because ${email} was entered at ${site()}.
Unsubscribe: ${optOut}`,
  };
}

export function goodbyeEmail(email: string) {
  // No unsubscribe link here on purpose — they just used it. What this
  // email needs instead is a way back, in case the click was a mistake.
  return {
    subject: "You've been unsubscribed",
    html: shell(
      `<p style="margin:0 0 14px;">You've been removed from the Instant newsletter and won't get any more of them.</p>
       <p style="margin:0 0 24px;">If that wasn't what you meant, you can sign up again any time.</p>
       <p style="margin:0;">${button(`${site()}/newsletter`, 'Resubscribe')}</p>`,
      `This confirms the unsubscribe for ${email}. No further action is needed.`
    ),
    text: `You've been removed from the Instant newsletter and won't get any
more of them.

If that wasn't what you meant, you can sign up again any time:
${site()}/newsletter

---
This confirms the unsubscribe for ${email}. No further action is needed.`,
  };
}
