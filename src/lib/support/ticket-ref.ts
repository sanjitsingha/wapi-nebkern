/**
 * Human-quotable reference for a support ticket.
 *
 * Tickets are keyed by UUID, which nobody can read over the phone or
 * paste into a chat without mangling. This derives a short display code
 * from the first block of the UUID instead of adding a sequential
 * number column — no migration, no counter to keep in sync between the
 * tenant app and the admin panel, and it stays stable for the life of
 * the ticket because it IS the id.
 *
 * 8 hex chars is ~4.3 billion values. Collisions are irrelevant here:
 * the code is a lookup aid for a human, not a key — the full UUID is
 * still what every query uses.
 *
 * Rendered in both apps (tenant support dialog + admin tickets table)
 * so a user quoting "#3F9A2C71" gives staff something to match on.
 */
export function formatTicketRef(id: string): string {
  return `#${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
