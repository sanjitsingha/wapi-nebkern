/**
 * The chrome every transactional email shares: the outer table, the
 * wordmark, the footer rule, and the one button style.
 *
 * Lifted out of newsletter-templates.ts when password reset needed the
 * same frame. Two copies of an email shell is how the newsletter ends
 * up on a white card and the reset code on a grey one.
 *
 * Written as inline-styled tables rather than anything clever. Email
 * clients are not browsers — Gmail strips <style> blocks, Outlook
 * renders through Word, and flexbox/grid are not available. Inline
 * styles on tables is the only layout that survives all of them.
 */

/**
 * Read at call time, not module load, so a template cannot freeze a
 * different base URL than its neighbours resolve per call.
 */
export function site(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://instant.nebkern.com'
  ).replace(/\/$/, '');
}

/** The brand palette, as literals. Emails cannot read CSS variables. */
export const GREEN = '#0b6623';
export const INK = '#191826';
export const SOFT = '#5c5a70';

export function shell(bodyHtml: string, footerHtml: string): string {
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

export function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px;">${label}</a>`;
}
