// ============================================================
// Shared shape of a message read.
//
// Both the thread's initial load (message-thread.tsx) and the inbox's
// incremental safety-net poll (inbox/page.tsx) select through here, so
// the two can never disagree about which columns exist on a row —
// merging a full row into a partial one would blank fields on screen.
//
// These used to be `select("*")`. On the free tier that mattered: the
// poll re-read the whole thread every 5 seconds, and `*` shipped every
// column of every row each time.
// ============================================================

/**
 * Every column the inbox actually renders, plus the two the sync needs
 * (`updated_at` as the watermark, `status` to detect a delivery-tick
 * change). Keep in step with the `Message` type in src/types.
 *
 * One unbroken literal on purpose. supabase-js parses the select string
 * at the TYPE level, and TypeScript does not constant-fold — both a
 * runtime `.join(',')` and a `'a,' + 'b'` concatenation widen to
 * `string`, which collapses the row type to `GenericStringError` and
 * makes every caller stop type-checking. Keep it on one line even
 * though it is long.
 */
// prettier-ignore
export const MESSAGE_COLUMNS = 'id,conversation_id,sender_type,sender_id,content_type,content_text,media_url,template_name,message_id,status,created_at,updated_at,reply_to_message_id,interactive_reply_id,whatsapp_form_id,form_answers';

/**
 * How often the open thread asks for changes.
 *
 * Was 5s, when this poll WAS the transport — Realtime on `messages`
 * could not be trusted before migration 078 flattened the table's RLS
 * policy. Now Realtime delivers and this is only a gap-filler for a
 * dropped socket, so it can be slow. Twelve reads an hour instead of
 * seven hundred and twenty.
 */
export const MESSAGE_SYNC_INTERVAL_MS = 30_000;

/**
 * Cap on rows returned by one incremental sync. A watermark query on an
 * idle thread returns zero rows; this only bites when a socket was down
 * long enough to miss a lot, and in that case the next tick picks up
 * where this one stopped — the watermark advances to the last row seen.
 */
export const MESSAGE_SYNC_LIMIT = 200;
