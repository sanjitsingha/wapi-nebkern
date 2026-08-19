/**
 * Every address the app sends mail as.
 *
 * WHY A REGISTRY RATHER THAN A `from` STRING AT EACH CALL SITE
 *
 * DeoMail rejects any sender it has not verified for your domain
 * (403 SENDER_NOT_AUTHORIZED), so the set of addresses we can send as
 * is small, fixed, and has to be kept in step with their dashboard.
 * Scattering literals through the app means the day you add an address
 * you find the call sites by grep and miss one. Here they are a closed
 * list you can read in ten seconds — and `listSenders()` below prints
 * exactly what needs verifying.
 *
 * HOW THE DISPLAY NAME WORKS (and how it does NOT)
 *
 * Verified against the live API:
 *
 *   from: "Instant <contact@instant.nebkern.com>"  -> SENDER_NOT_AUTHORIZED
 *   from: "contact@instant.nebkern.com"            -> success
 *
 * DeoMail matches the whole `from` string against its verified list, so
 * an RFC 5322 `Name <addr>` header reads as an unknown sender. `from`
 * is therefore always a BARE address, and an override written the
 * habitual `Name <addr>` way gets stripped rather than failing.
 *
 * The name below goes in a separate `from_name` field. That field is
 * NOT in DeoMail's published docs — it is accepted rather than
 * rejected, which is not the same as honoured. If Gmail still shows no
 * name, DeoMail is ignoring it and the display name has to be set on
 * the verified sender in their dashboard instead. Nothing here breaks
 * either way: the address is what actually routes the mail.
 *
 * ADDING ONE
 *
 * Add a line to SENDERS. It resolves to `<local>@MAIL_DOMAIN` with no
 * further config. Override the address with `MAIL_FROM_<KEY>` when it
 * needs a different domain.
 */

export const SENDERS = {
  /** Newsletter welcome / goodbye. Bulk-ish, and the address people
   *  will filter or block first — hence a dedicated local part by
   *  default, so a spam complaint here cannot poison password resets.
   *
   *  The NAME says "Contact" because production overrides the address
   *  to contact@ (MAIL_FROM_NEWSLETTER); the name has to match the
   *  address people actually see, not this default. */
  newsletter: { local: 'newsletter', name: 'Contact - Instant' },

  /** Support ticket replies and notifications. Replies to this should
   *  reach a human, so it is deliberately not a no-reply. */
  support: { local: 'support', name: 'Support - Instant' },

  /** Invoices, receipts, dunning. Separated because finance mail is
   *  what people search their inbox for later. */
  billing: { local: 'billing', name: 'Billing - Instant' },

  /** Anything automated with no meaningful reply address — alerts,
   *  confirmations, system notices. */
  system: { local: 'no-reply', name: 'Instant' },
} as const;

export type SenderKey = keyof typeof SENDERS;

export interface ResolvedSender {
  /** Bare address. This is what DeoMail matches against. */
  address: string;
  /** Sent as `from_name`. See the note above on whether it takes. */
  name: string;
}

/** `MAIL_FROM_NEWSLETTER`, `MAIL_FROM_SUPPORT`, … */
function overrideVar(key: SenderKey): string {
  return `MAIL_FROM_${key.toUpperCase()}`;
}

/**
 * Pull the bare address out of a configured value.
 *
 * Accepts `addr@x.com` and `Name <addr@x.com>` — the second because it
 * is the format everyone writes from habit, and because passing it
 * through produces SENDER_NOT_AUTHORIZED, which reads as "my domain
 * isn't verified" rather than "your env has a display name in it".
 */
function bareAddress(value: string): string {
  const angled = value.match(/<([^>]+)>/);
  return (angled ? angled[1] : value).trim();
}

/**
 * The sender for a key, or null when no address is configured.
 *
 * Null rather than a throw: a missing address is a deployment gap, and
 * the callers all send mail as a side effect of work that has already
 * succeeded. They log and carry on rather than failing a request the
 * visitor cares about.
 */
export function resolveSender(key: SenderKey): ResolvedSender | null {
  const { local, name } = SENDERS[key];

  // A full override wins outright — the escape hatch for an address on
  // another domain. The NAME still comes from the registry: it is brand
  // copy, not deployment config, and having it in two places is how the
  // two drift apart.
  const override = process.env[overrideVar(key)]?.trim();
  if (override) {
    const address = bareAddress(override);
    return address ? { address, name } : null;
  }

  const domain = process.env.MAIL_DOMAIN?.trim().replace(/^@/, '');
  if (!domain) return null;

  return { address: `${local}@${domain}`, name };
}

/**
 * Every sender and where it currently resolves from.
 *
 * For a startup or admin health check: each address here has to exist
 * as a verified sender in DeoMail, and there is no way to discover that
 * from the API before a send fails.
 */
export function listSenders(): {
  key: SenderKey;
  address: string | null;
  name: string;
  source: 'override' | 'domain' | 'unset';
}[] {
  return (Object.keys(SENDERS) as SenderKey[]).map((key) => {
    const override = process.env[overrideVar(key)]?.trim();
    const resolved = resolveSender(key);
    return {
      key,
      address: resolved?.address ?? null,
      name: SENDERS[key].name,
      source: override ? 'override' : resolved ? 'domain' : 'unset',
    };
  });
}
