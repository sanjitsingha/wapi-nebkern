import { unsubscribeUrl } from '@/lib/newsletter-unsubscribe';
// The frame, the wordmark and the button live in ./shell — password
// reset needed the same chrome, and two copies of an email shell drift.
import { button, shell, site, SOFT } from './shell';

/**
 * The two newsletter emails: welcome on signup, confirmation on the way
 * out.
 *
 * Every template returns html AND text. A missing text/plain part reads
 * as spam to most filters, and some people genuinely read mail in
 * plain text.
 */

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
